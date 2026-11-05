'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createDriveBackupOAuthHandlers } = require('../utils/driveBackupOAuth');
const { DRIVE_SCOPE, EMAIL_SCOPE, openDriveTokens, sealDriveTokens } = require('../services/driveBackupService');

const ownerId = '507f1f77bcf86cd799439011';
const identity = { id: ownerId, role: 'admin' };
const env = {
  NODE_ENV: 'production',
  GOOGLE_CLIENT_ID: 'disposable-client',
  GOOGLE_CLIENT_SECRET: 'disposable-secret',
  VAULT_SECRET: 'x'.repeat(32),
  DRIVE_BACKUP_REDIRECT_URI: 'https://api.example.test/api/integrations/drive-backups/callback',
  FRONTEND_URL: 'https://studio.example.test',
};
function response() {
  return {
    headers: {}, cookies: [], cleared: [], statusCode: 200,
    set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    redirect(value) { this.location = value; return this; },
    cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
    clearCookie(name, options) { this.cleared.push({ name, options }); return this; },
  };
}
function fixture(options = {}) {
  const records = new Map();
  const owner = { _id: ownerId, role: 'admin', studioOwner: true, email: 'owner@example.test', accountDisabled: false };
  const User = {
    async findById(id) { return id === ownerId ? owner : null; },
    async findOne(query) { return query._id === ownerId && query.role === owner.role ? owner : null; },
  };
  const store = {
    async create(value) { assert.equal(records.has(value._id), false); records.set(value._id, { ...value }); },
    async findOneAndDelete(query) {
      const row = records.get(query._id);
      if (!row || row.kind !== query.kind || !(row.expiresAt > query.expiresAt.$gt) || (query.browserHash && row.browserHash !== query.browserHash)) return null;
      records.delete(query._id);
      return row;
    },
  };
  let saved = options.existing || null;
  const mutations = [], authorization = [], exchanges = [];
  const Connection = {
    findOne({ userId }) { assert.equal(userId, ownerId); return { select: async () => saved }; },
    async findOneAndUpdate(query, update, flags) {
      assert.equal(query.userId, ownerId);
      assert.equal(flags.upsert, true);
      assert.equal(flags.runValidators, true);
      mutations.push({ query, update });
      saved = { ...saved, ...update.$set };
      return saved;
    },
  };
  const handlers = createDriveBackupOAuthHandlers({
    User, Connection, store, env,
    now: () => Date.parse('2026-11-03T08:00:00Z'),
    makeClient(config) {
      assert.equal(config.redirectUri, env.DRIVE_BACKUP_REDIRECT_URI);
      return {
        generateAuthUrl(params) {
          authorization.push(params);
          return 'https://accounts.example.test/authorize?state=' + params.state;
        },
        async getToken(params) {
          exchanges.push(params);
          return { tokens: {
            access_token: 'disposable-access',
            refresh_token: options.noRefresh ? undefined : 'disposable-refresh',
            expiry_date: 1793700000000,
            scope: options.scope === undefined ? [DRIVE_SCOPE, EMAIL_SCOPE].join(' ') : options.scope,
          } };
        },
        setCredentials(tokens) { this.credentials = tokens; },
      };
    },
    getProfile: async () => options.profile || { email: 'Owner@Example.Test', verified_email: true },
  });
  return { owner, handlers, records, authorization, exchanges, mutations, saved: () => saved };
}
async function start(f) {
  const res = response();
  await f.handlers.start({ user: identity }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  const url = new URL(res.body.url);
  assert.equal(url.origin + url.pathname, 'https://api.example.test/api/integrations/drive-backups/begin');
  assert.match(url.searchParams.get('ticket'), /^[a-f0-9]{64}$/);
  return url.searchParams.get('ticket');
}
async function begin(f) {
  const ticket = await start(f), res = response();
  await f.handlers.begin({ query: { ticket } }, res);
  assert.equal(f.authorization.length, 1, 'saved owner identity must reach the Drive begin handler');
  assert.equal(new URL(res.location).hostname, 'accounts.example.test');
  assert.equal(res.cookies.length, 1);
  const cookie = res.cookies[0], params = f.authorization[0];
  assert.equal(cookie.name, '__Host-ta_drive_backup');
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(cookie.options.sameSite, 'lax');
  assert.equal(cookie.options.path, '/');
  assert.deepEqual(params.scope, [DRIVE_SCOPE, EMAIL_SCOPE]);
  assert.equal(params.access_type, 'offline');
  assert.equal(params.prompt, 'consent');
  assert.equal(params.code_challenge_method, 'S256');
  assert.match(params.code_challenge, /^[A-Za-z0-9_-]{43}$/);
  return { ticket, cookie, state: params.state, challenge: params.code_challenge };
}
const callbackRequest = flow => ({
  query: { state: flow.state, code: 'disposable-authorization-code' },
  headers: { cookie: flow.cookie.name + '=' + flow.cookie.value },
});

test('Drive owner start, browser-bound PKCE begin and callback complete once without provider network access', async () => {
  const f = fixture(), flow = await begin(f);
  const replayBegin = response();
  await f.handlers.begin({ query: { ticket: flow.ticket } }, replayBegin);
  assert.match(replayBegin.location, /driveBackup=error$/);
  assert.equal(f.authorization.length, 1);

  const wrongBrowser = response(), wrongRequest = callbackRequest(flow);
  wrongRequest.headers.cookie = flow.cookie.name + '=' + 'f'.repeat(64);
  await f.handlers.callback(wrongRequest, wrongBrowser);
  assert.match(wrongBrowser.location, /driveBackup=error$/);
  assert.equal(f.exchanges.length, 0);
  assert.equal(f.mutations.length, 0);

  const res = response();
  await f.handlers.callback(callbackRequest(flow), res);
  assert.equal(res.location, 'https://studio.example.test/admin/settings?section=backups&driveBackup=connected');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(res.cleared.length, 1);
  assert.equal(res.cleared[0].name, flow.cookie.name);
  assert.equal(f.exchanges.length, 1);
  const exchange = f.exchanges[0];
  assert.equal(exchange.redirect_uri, env.DRIVE_BACKUP_REDIRECT_URI);
  assert.equal(exchange.code, 'disposable-authorization-code');
  assert.match(exchange.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(crypto.createHash('sha256').update(exchange.codeVerifier).digest('base64url'), flow.challenge);
  assert.equal(f.mutations.length, 1);
  const row = f.saved();
  assert.equal(row.email, 'owner@example.test');
  assert.equal(row.tokenEnvelope.includes('disposable-refresh'), false);
  assert.equal(openDriveTokens(row.tokenEnvelope, ownerId, env).refresh_token, 'disposable-refresh');

  const replay = response();
  await f.handlers.callback(callbackRequest(flow), replay);
  assert.match(replay.location, /driveBackup=error$/);
  assert.equal(f.exchanges.length, 1);
  assert.equal(f.mutations.length, 1);
});

test('Drive rechecks disabled owner at start, begin and callback before exchanging credentials', async () => {
  const disabledStart = fixture();
  disabledStart.owner.accountDisabled = true;
  const res = response();
  await disabledStart.handlers.start({ user: identity }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(disabledStart.records.size, 0);

  const disabledBegin = fixture(), ticket = await start(disabledBegin);
  disabledBegin.owner.accountDisabled = true;
  const beginRes = response();
  await disabledBegin.handlers.begin({ query: { ticket } }, beginRes);
  assert.match(beginRes.location, /driveBackup=error$/);
  assert.equal(disabledBegin.authorization.length, 0);

  const disabledCallback = fixture(), flow = await begin(disabledCallback);
  disabledCallback.owner.accountDisabled = true;
  const callbackRes = response();
  await disabledCallback.handlers.callback(callbackRequest(flow), callbackRes);
  assert.match(callbackRes.location, /driveBackup=error$/);
  assert.equal(disabledCallback.exchanges.length, 0);
  assert.equal(disabledCallback.mutations.length, 0);
});

test('Drive refuses partial permissions or an unverified Google email without storing a connection', async () => {
  for (const options of [
    { scope: EMAIL_SCOPE },
    { scope: DRIVE_SCOPE },
    { profile: { email: 'owner@example.test', verified_email: false } },
  ]) {
    const f = fixture(options), flow = await begin(f), res = response();
    await f.handlers.callback(callbackRequest(flow), res);
    assert.match(res.location, /driveBackup=error$/);
    assert.equal(f.mutations.length, 0);
  }
});

test('Drive reuses an offline token only for the same verified Google account', async () => {
  for (const sameAccount of [true, false]) {
    const existing = {
      email: sameAccount ? 'owner@example.test' : 'different@example.test',
      tokenEnvelope: sealDriveTokens({ refresh_token: 'previous-disposable-refresh' }, ownerId, env),
    };
    const f = fixture({ existing, noRefresh: true }), flow = await begin(f), res = response();
    await f.handlers.callback(callbackRequest(flow), res);
    assert.equal(f.mutations.length, sameAccount ? 1 : 0);
    assert.match(res.location, sameAccount ? /driveBackup=connected$/ : /driveBackup=error$/);
    if (sameAccount) assert.equal(openDriveTokens(f.saved().tokenEnvelope, ownerId, env).refresh_token, 'previous-disposable-refresh');
  }
});
