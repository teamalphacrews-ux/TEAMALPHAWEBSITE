const crypto = require("crypto");
const mongoose = require("mongoose");

const HANDOFF_MS = 2 * 60 * 1000;
const STATE_MS = 10 * 60 * 1000;
const validNonce = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const fail = (status = 400) =>
  Object.assign(
    new Error(
      "Google connection could not be verified. Please start again from the studio calendar.",
    ),
    { status },
  );

function nonceModel() {
  if (mongoose.models.OAuthStateNonce) return mongoose.models.OAuthStateNonce;
  const schema = new mongoose.Schema({
    _id: String,
    kind: { type: String, enum: ["handoff", "state"], required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    browserHash: String,
    codeVerifier: String,
    expiresAt: { type: Date, required: true },
  });
  // Authentication always checks expiresAt explicitly: TTL is cleanup only.
  // The built-in unique _id index provides atomic single use on every instance.
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return mongoose.model("OAuthStateNonce", schema);
}

function createOAuthStateService({
  store = nonceModel(),
  User = require("../models/User"),
  now = Date.now,
  randomBytes = crypto.randomBytes,
} = {}) {
  const random = () => randomBytes(32).toString("hex");
  async function admin(userId) {
    if (typeof userId !== "string" || !/^[a-f\d]{24}$/i.test(userId))
      throw fail(403);
    const user = await User.findOne({ _id: userId, role: "admin" });
    if (!user || user.role !== "admin") throw fail(403);
    return user;
  }
  async function issue(identity) {
    if (identity?.role !== "admin") throw fail(403);
    const user = await admin(identity.id);
    const ticket = random();
    await store.create({
      _id: digest(ticket),
      kind: "handoff",
      userId: user._id,
      expiresAt: new Date(now() + HANDOFF_MS),
    });
    return ticket;
  }
  async function begin(ticket) {
    if (!validNonce(ticket)) throw fail();
    const handoff = await store.findOneAndDelete({
      _id: digest(ticket),
      kind: "handoff",
      expiresAt: { $gt: new Date(now()) },
    });
    if (!handoff) throw fail();
    const user = await admin(String(handoff.userId));
    const state = random();
    const browser = random();
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    await store.create({
      _id: digest(state),
      kind: "state",
      userId: user._id,
      browserHash: digest(browser),
      codeVerifier,
      expiresAt: new Date(now() + STATE_MS),
    });
    return { state, browser, codeChallenge };
  }
  async function consume(state, browser) {
    if (!validNonce(state) || !validNonce(browser)) throw fail();
    // A wrong browser cannot consume another browser's valid authorization.
    const record = await store.findOneAndDelete({
      _id: digest(state),
      kind: "state",
      browserHash: digest(browser),
      expiresAt: { $gt: new Date(now()) },
    });
    if (!record) throw fail();
    if (
      typeof record.codeVerifier !== "string" ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(record.codeVerifier)
    )
      throw fail();
    const user = await admin(String(record.userId));
    return { userId: String(user._id), codeVerifier: record.codeVerifier };
  }
  return { issue, begin, consume };
}

function configuredUrl(value, env) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail(503);
  }
  const local =
    env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  )
    throw fail(503);
  return url;
}
function configuration(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw fail(503);
  const redirect = configuredUrl(env.GOOGLE_REDIRECT_URI, env);
  if (
    redirect.pathname !== "/api/auth/google/callback" ||
    redirect.search ||
    redirect.hash
  )
    throw fail(503);
  const frontend = configuredUrl(env.FRONTEND_URL, env);
  const secure = redirect.protocol === "https:";
  return {
    redirectUri: redirect.href,
    beginUrl: new URL("/api/auth/google/begin", redirect).href,
    frontendOrigin: frontend.origin,
    cookieName: secure ? "__Host-ta_google_oauth" : "ta_google_oauth",
    cookie: {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MS,
    },
  };
}
function browserCookie(req, name) {
  const header = req.headers?.cookie;
  if (typeof header !== "string" || header.length > 8192) return null;
  const entries = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="));
  if (entries.length !== 1) return null;
  const value = entries[0].slice(name.length + 1);
  return validNonce(value) ? value : null;
}

function createGoogleOAuthHandlers({
  User = require("../models/User"),
  store,
  env = process.env,
  now,
  randomBytes,
  makeClient,
  getGoogleEmail,
  onConnected = async () => {},
} = {}) {
  const state = createOAuthStateService({
    User,
    ...(store ? { store } : {}),
    ...(now ? { now } : {}),
    ...(randomBytes ? { randomBytes } : {}),
  });
  const client = (config) =>
    makeClient
      ? makeClient(config)
      : new (require("googleapis").google.auth.OAuth2)(
          env.GOOGLE_CLIENT_ID,
          env.GOOGLE_CLIENT_SECRET,
          config.redirectUri,
        );
  const prepare = (res) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
  };
  const failedRedirect = (res) => {
    try {
      res.redirect(
        configuredUrl(env.FRONTEND_URL, env).origin +
          "/admin/calendar?sync=error",
      );
    } catch {
      res
        .status(503)
        .json({
          msg: "Google Calendar connection is unavailable. Please contact the studio administrator.",
        });
    }
  };
  return {
    start: async (req, res) => {
      prepare(res);
      try {
        const config = configuration(env);
        const ticket = await state.issue(req.user);
        res.json({ url: config.beginUrl + "?ticket=" + ticket });
      } catch (error) {
        res
          .status(error.status || 503)
          .json({
            msg:
              error.status === 403
                ? "Use a saved studio administrator account to connect Google Calendar."
                : "Google Calendar connection is unavailable. Please try again from the studio calendar.",
          });
      }
    },
    begin: async (req, res) => {
      prepare(res);
      try {
        const config = configuration(env);
        const flow = await state.begin(req.query?.ticket);
        const url = client(config).generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: [
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
          state: flow.state,
          code_challenge_method: "S256",
          code_challenge: flow.codeChallenge,
        });
        // Top-level API navigation allows first-party binding on Safari without
        // requiring third-party cookies in the frontend's authenticated fetch.
        res.cookie(config.cookieName, flow.browser, config.cookie);
        res.redirect(url);
      } catch {
        failedRedirect(res);
      }
    },
    callback: async (req, res) => {
      prepare(res);
      try {
        const config = configuration(env);
        const browser = browserCookie(req, config.cookieName);
        const flow = await state.consume(req.query?.state, browser);
        const clearOptions = { ...config.cookie };
        delete clearOptions.maxAge;
        res.clearCookie(config.cookieName, clearOptions);
        const code = req.query?.code;
        if (
          req.query?.error ||
          typeof code !== "string" ||
          !code ||
          code.length > 4096
        )
          throw fail();
        const oauth = client(config);
        // google-auth-library maps codeVerifier to the token endpoint's
        // code_verifier field; generateAuthUrl accepts code_challenge above.
        const { tokens } = await oauth.getToken({
          code,
          codeVerifier: flow.codeVerifier,
          redirect_uri: config.redirectUri,
        });
        if (
          !tokens ||
          typeof tokens.access_token !== "string" ||
          !tokens.access_token
        )
          throw fail();
        oauth.setCredentials(tokens);
        const scopes = typeof tokens.scope === "string"
          ? tokens.scope.split(/\s+/)
          : (await oauth.getTokenInfo(tokens.access_token)).scopes;
        if (!Array.isArray(scopes) || !scopes.some(scope => [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar",
        ].includes(scope))) throw fail();
        const email = getGoogleEmail
          ? await getGoogleEmail(oauth)
          : (
              await require("googleapis")
                .google.oauth2({ version: "v2", auth: oauth })
                .userinfo.get()
            ).data.email;
        if (
          typeof email !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        )
          throw fail();
        const update = {
          googleAccessToken: tokens.access_token,
          googleTokenExpiry: Number.isFinite(tokens.expiry_date)
            ? new Date(tokens.expiry_date)
            : null,
          googleEmail: email,
        };
        const hasRefreshToken = typeof tokens.refresh_token === "string" && Boolean(tokens.refresh_token);
        if (hasRefreshToken)
          update.googleRefreshToken = tokens.refresh_token;
        // Recheck authority atomically after the provider round trip as well.
        // A refresh token from another Google account must never be reused.
        const accountFilter = { _id: flow.userId, role: "admin" };
        if (!hasRefreshToken) {
          accountFilter.googleEmail = email;
          accountFilter.googleRefreshToken = { $type: "string", $ne: "" };
        }
        const user = await User.findOneAndUpdate(
          accountFilter,
          { $set: update },
          { new: true },
        );
        if (!user) throw fail(403);
        await onConnected(user, req);
        res.redirect(config.frontendOrigin + "/admin/calendar?sync=success");
      } catch {
        failedRedirect(res);
      }
    },
  };
}

module.exports = {
  createOAuthStateService,
  createGoogleOAuthHandlers,
  browserCookie,
  configuration,
  HANDOFF_MS,
  STATE_MS,
};
