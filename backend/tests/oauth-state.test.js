const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { google } = require("googleapis");
const {
  createOAuthStateService,
  createGoogleOAuthHandlers,
  browserCookie,
  configuration,
  HANDOFF_MS,
  STATE_MS,
} = require("../utils/oauthState");

const adminId = "507f1f77bcf86cd799439011";
const identity = { id: adminId, role: "admin" };
const env = {
  NODE_ENV: "production",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REDIRECT_URI: "https://api.example.test/api/auth/google/callback",
  FRONTEND_URL: "https://studio.example.test",
};

function fixture() {
  const records = new Map();
  const users = new Map([
    [
      adminId,
      {
        _id: adminId,
        role: "admin",
        googleEmail: "studio-owner@example.test",
        googleRefreshToken: "existing-test-refresh",
      },
    ],
  ]);
  let now = Date.parse("2026-10-20T12:00:00Z");
  let mutations = 0;
  const store = {
    async create(record) {
      assert.ok(!records.has(record._id));
      records.set(record._id, { ...record });
      return record;
    },
    async findOneAndDelete(query) {
      const record = records.get(query._id);
      if (
        !record ||
        record.kind !== query.kind ||
        (query.browserHash && record.browserHash !== query.browserHash) ||
        !(record.expiresAt > query.expiresAt.$gt)
      )
        return null;
      records.delete(query._id);
      return record;
    },
  };
  const User = {
    async findOne(query) {
      const user = users.get(String(query._id));
      return user?.role === query.role ? user : null;
    },
    async findOneAndUpdate(query, update) {
      const user = users.get(String(query._id));
      if (user?.role !== query.role) return null;
      if (query.googleEmail && user.googleEmail !== query.googleEmail) return null;
      if (query.googleRefreshToken && (typeof user.googleRefreshToken !== "string" || !user.googleRefreshToken)) return null;
      mutations += 1;
      Object.assign(user, update.$set);
      return user;
    },
  };
  const options = { store, User, now: () => now };
  return {
    ...options,
    records,
    users,
    service: createOAuthStateService(options),
    advance: (ms) => {
      now += ms;
    },
    mutations: () => mutations,
  };
}
async function opened(f) {
  return f.service.begin(await f.service.issue(identity));
}
function response() {
  return {
    headers: {},
    cookies: [],
    cleared: [],
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(url) {
      this.location = url;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
      return this;
    },
  };
}
function routes(f, extra = {}) {
  const exchanges = [];
  const credentials = [];
  const makeClient = (config) => {
    const oauth = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      config.redirectUri,
    );
    oauth.getToken = async (options) => {
      exchanges.push(options);
      return {
        tokens: {
          access_token: "test-access",
          scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
          expiry_date: Date.now() + 3600000,
        },
      };
    };
    oauth.setCredentials = (tokens) => {
      credentials.push(tokens);
    };
    return oauth;
  };
  return {
    handlers: createGoogleOAuthHandlers({
      ...f,
      env,
      makeClient,
      getGoogleEmail: async () => "studio-owner@example.test",
      ...extra,
    }),
    exchanges,
    credentials,
  };
}

test("OAuth handoffs require a current database administrator and cannot use virtual account IDs", async () => {
  const f = fixture();
  await assert.rejects(f.service.issue({ ...identity, role: "client" }), {
    status: 403,
  });
  await assert.rejects(
    f.service.issue({ id: "hardcoded-admin-id", role: "admin" }),
    { status: 403 },
  );
  f.users.get(adminId).role = "client";
  await assert.rejects(f.service.issue(identity), { status: 403 });
  assert.equal(f.records.size, 0);
});

test("opaque handoffs expire and can be exchanged once, with no raw tokens stored", async () => {
  const f = fixture();
  const ticket = await f.service.issue(identity);
  assert.match(ticket, /^[a-f0-9]{64}$/);
  assert.notEqual([...f.records.keys()][0], ticket);
  const flow = await f.service.begin(ticket);
  await assert.rejects(f.service.begin(ticket), { status: 400 });
  assert.match(flow.state, /^[a-f0-9]{64}$/);
  assert.notEqual(flow.state, flow.browser);
  assert.equal(flow.codeVerifier, undefined);
  const record = [...f.records.values()][0];
  assert.equal(record.state, undefined);
  assert.equal(record.browser, undefined);
  assert.notEqual(record._id, flow.state);
  assert.notEqual(record.browserHash, flow.browser);
  assert.match(record.codeVerifier, /^[A-Za-z0-9._~-]{43,128}$/);
  assert.equal(
    flow.codeChallenge,
    crypto.createHash("sha256").update(record.codeVerifier).digest("base64url"),
  );
  const expiredTicket = await f.service.issue(identity);
  f.advance(HANDOFF_MS);
  await assert.rejects(f.service.begin(expiredTicket), { status: 400 });
});

test("missing, spoofed, malformed and cross-browser state fail before consuming the legitimate flow", async () => {
  const f = fixture();
  const flow = await opened(f);
  for (const [state, browser] of [
    [undefined, flow.browser],
    [flow.state, undefined],
    [adminId, flow.browser],
    [[flow.state], flow.browser],
    ["a".repeat(64), flow.browser],
    [flow.state, "b".repeat(64)],
  ])
    await assert.rejects(f.service.consume(state, browser), { status: 400 });
  assert.equal(
    (await f.service.consume(flow.state, flow.browser)).userId,
    adminId,
  );
  await assert.rejects(f.service.consume(flow.state, flow.browser), {
    status: 400,
  });
});

test("expired state cannot be used even when TTL cleanup has not deleted the Mongo record", async () => {
  const f = fixture();
  const flow = await opened(f);
  f.advance(STATE_MS);
  assert.equal(f.records.size, 1);
  await assert.rejects(f.service.consume(flow.state, flow.browser), {
    status: 400,
  });
});

test("deleted or demoted administrators cannot complete an already-issued flow", async () => {
  for (const deleted of [false, true]) {
    const f = fixture();
    const flow = await opened(f);
    if (deleted) f.users.delete(adminId);
    else f.users.get(adminId).role = "client";
    await assert.rejects(f.service.consume(flow.state, flow.browser), {
      status: 403,
    });
    assert.equal(f.records.size, 0);
  }
});

test("concurrent callbacks claim one server-side state record", async () => {
  const f = fixture();
  const flow = await opened(f);
  const result = await Promise.allSettled([
    f.service.consume(flow.state, flow.browser),
    f.service.consume(flow.state, flow.browser),
  ]);
  assert.equal(
    result.filter((value) => value.status === "fulfilled").length,
    1,
  );
  assert.equal(result.filter((value) => value.status === "rejected").length, 1);
});

test("first-party begin sets a host-bound secure cookie and sends supported PKCE authorization parameters", async () => {
  const f = fixture();
  const { handlers } = routes(f);
  const start = response();
  await handlers.start({ user: identity }, start);
  const beginUrl = new URL(start.body.url);
  assert.equal(beginUrl.origin, "https://api.example.test");
  assert.equal(beginUrl.pathname, "/api/auth/google/begin");
  const begin = response();
  await handlers.begin(
    { query: { ticket: beginUrl.searchParams.get("ticket") } },
    begin,
  );
  assert.equal(begin.cookies[0].name, "__Host-ta_google_oauth");
  assert.equal(begin.cookies[0].options.secure, true);
  assert.equal(begin.cookies[0].options.httpOnly, true);
  assert.equal(begin.cookies[0].options.sameSite, "lax");
  assert.equal(begin.cookies[0].options.path, "/");
  assert.equal(begin.cookies[0].options.domain, undefined);
  const consent = new URL(begin.location);
  assert.equal(consent.origin, "https://accounts.google.com");
  assert.deepEqual(consent.searchParams.get("scope").split(" "), [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
  ]);
  assert.equal(consent.searchParams.get("code_challenge_method"), "S256");
  assert.match(
    consent.searchParams.get("code_challenge"),
    /^[A-Za-z0-9_-]{43}$/,
  );
  assert.match(consent.searchParams.get("state"), /^[a-f0-9]{64}$/);
  assert.equal(start.headers["Cache-Control"], "no-store");
  assert.equal(begin.headers["Referrer-Policy"], "no-referrer");
});

test("email-only Google consent cannot become a connected Calendar account", async () => {
  const f = fixture();
  const flow = await opened(f);
  let connected = 0;
  const { handlers } = routes(f, {
    makeClient: () => ({
      getToken: async () => ({ tokens: { access_token: "test-access", scope: "https://www.googleapis.com/auth/userinfo.email" } }),
      setCredentials() {},
    }),
    onConnected: async () => { connected++; },
  });
  const result = response();
  await handlers.callback({ query: { state: flow.state, code: "test-code" }, headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` } }, result);
  assert.equal(result.location, "https://studio.example.test/admin/calendar?sync=error");
  assert.equal(f.mutations(), 0);
  assert.equal(connected, 0);
});

test("missing token-response scopes are verified with Google token information before saving", async () => {
  for (const scopes of [["https://www.googleapis.com/auth/calendar.events"], ["https://www.googleapis.com/auth/calendar"], ["https://www.googleapis.com/auth/calendar.readonly"]]) {
    const f = fixture();
    const flow = await opened(f);
    let inspected = 0;
    const { handlers } = routes(f, {
      makeClient: () => ({
        getToken: async () => ({ tokens: { access_token: "test-access" } }),
        setCredentials() {},
        getTokenInfo: async token => { assert.equal(token, "test-access"); inspected++; return { scopes }; },
      }),
    });
    const result = response();
    await handlers.callback({ query: { state: flow.state, code: "test-code" }, headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` } }, result);
    assert.equal(inspected, 1);
    assert.equal(f.mutations(), scopes[0].endsWith("readonly") ? 0 : 1);
    assert.equal(result.location.endsWith("sync=success"), !scopes[0].endsWith("readonly"));
  }
});

test("callback never pairs a different Google account with an old refresh token", async () => {
  for (const account of [{googleEmail:"another-account@example.test"}, {googleRefreshToken:""}]) {
    const f=fixture();
    Object.assign(f.users.get(adminId),account);
    const flow=await opened(f);
    const {handlers}=routes(f);
    const result=response();
    await handlers.callback({query:{state:flow.state,code:"test-code"},headers:{cookie:`__Host-ta_google_oauth=${flow.browser}`}},result);
    assert.equal(result.location,"https://studio.example.test/admin/calendar?sync=error");
    assert.equal(f.mutations(),0);
  }
});

test("verified callback passes codeVerifier to the installed client and preserves an existing refresh token", async () => {
  const f = fixture();
  const flow = await opened(f);
  const { handlers, exchanges } = routes(f);
  const result = response();
  await handlers.callback(
    {
      query: { state: flow.state, code: "test-code" },
      headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` },
    },
    result,
  );
  assert.equal(
    result.location,
    "https://studio.example.test/admin/calendar?sync=success",
  );
  assert.equal(exchanges.length, 1);
  assert.match(exchanges[0].codeVerifier, /^[A-Za-z0-9._~-]{43,128}$/);
  assert.equal(exchanges[0].redirect_uri, env.GOOGLE_REDIRECT_URI);
  assert.equal(
    f.users.get(adminId).googleRefreshToken,
    "existing-test-refresh",
  );
  assert.equal(f.mutations(), 1);
  assert.equal(result.cleared.length, 1);
  const retry = response();
  await handlers.callback(
    {
      query: { state: flow.state, code: "test-code" },
      headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` },
    },
    retry,
  );
  assert.equal(
    retry.location,
    "https://studio.example.test/admin/calendar?sync=error",
  );
  assert.equal(exchanges.length, 1);
});

test("unverified callbacks and denial responses never exchange codes or modify users", async () => {
  const f = fixture();
  const flow = await opened(f);
  const { handlers, exchanges } = routes(f);
  for (const request of [
    { query: { state: flow.state, code: "test-code" }, headers: {} },
    {
      query: { state: "bad", code: "test-code" },
      headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` },
    },
    {
      query: { state: flow.state, error: "access_denied" },
      headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` },
    },
  ]) {
    const result = response();
    await handlers.callback(request, result);
    assert.equal(
      result.location,
      "https://studio.example.test/admin/calendar?sync=error",
    );
  }
  assert.equal(exchanges.length, 0);
  assert.equal(f.mutations(), 0);
});

test("role changes during token exchange are rejected by the atomic admin update", async () => {
  const f = fixture();
  const flow = await opened(f);
  const { handlers } = routes(f, {
    makeClient: () => ({
      async getToken() {
        f.users.get(adminId).role = "client";
        return { tokens: { access_token: "test-access" } };
      },
      setCredentials() {},
    }),
  });
  const result = response();
  await handlers.callback(
    {
      query: { state: flow.state, code: "test-code" },
      headers: { cookie: `__Host-ta_google_oauth=${flow.browser}` },
    },
    result,
  );
  assert.equal(
    result.location,
    "https://studio.example.test/admin/calendar?sync=error",
  );
  assert.equal(f.mutations(), 0);
});

test("insecure production configuration and duplicate binding cookies fail closed", async () => {
  assert.throws(
    () =>
      configuration({
        ...env,
        GOOGLE_REDIRECT_URI: "http://api.example.test/api/auth/google/callback",
      }),
    { status: 503 },
  );
  assert.throws(
    () => configuration({ ...env, FRONTEND_URL: "javascript:bad" }),
    { status: 503 },
  );
  const browser = "c".repeat(64);
  assert.equal(
    browserCookie(
      {
        headers: {
          cookie: `__Host-ta_google_oauth=${browser}; __Host-ta_google_oauth=${browser}`,
        },
      },
      "__Host-ta_google_oauth",
    ),
    null,
  );
  assert.equal(
    browserCookie(
      { headers: { cookie: `__Host-ta_google_oauth=${browser}` } },
      "__Host-ta_google_oauth",
    ),
    browser,
  );
});

test("the installed Google client serializes PKCE codeVerifier as code_verifier without network access", async () => {
  const oauth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
  let request;
  oauth.transporter.request = async (options) => {
    request = options;
    return {
      data: { access_token: "transport-test-access", expires_in: 3600 },
    };
  };
  const verifier = crypto.randomBytes(32).toString("base64url");
  await oauth.getToken({
    code: "transport-test-code",
    codeVerifier: verifier,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
  });
  assert.equal(request.method, "POST");
  assert.equal(request.data.get("code_verifier"), verifier);
  assert.equal(request.data.get("redirect_uri"), env.GOOGLE_REDIRECT_URI);
  assert.equal(request.data.get("code"), "transport-test-code");
});
