const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createSocialAuth, createIdTokenVerifier, providerConfig, publicProviderStatus, digest } = require('../saas/socialAuth');
const time = Date.parse('2026-10-26T12:00:00.000Z');
const clientId = 'studio-test.apps.googleusercontent.com';
const env = { NODE_ENV: 'test', SAAS_ENABLED: 'true', SAAS_SIGNUP_ENABLED: 'true', FRONTEND_URL: 'https://studio.example.com', SAAS_GOOGLE_CLIENT_ID: clientId, SAAS_GOOGLE_CLIENT_SECRET: 'test-only-provider-secret', SAAS_GOOGLE_REDIRECT_URI: 'https://api.example.com/api/saas/oauth/google/callback' };
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
const jsonResponse = data => ({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify(data) });
function token(overrides = {}, options = {}) {
  return jwt.sign({ iss: 'https://accounts.google.com', aud: clientId, sub: 'provider-person-1', email: 'owner@example.com', email_verified: true, nonce: 'nonce-for-test', iat: time / 1000, exp: time / 1000 + 3600, ...overrides }, options.key || privateKey, { algorithm: options.algorithm || 'RS256', keyid: options.kid || 'test-key' });
}
const verification = { clientId, nonceHash: digest('nonce-for-test') };
test('social providers fail closed without gates, exact callbacks and valid Apple HTTPS/key configuration', () => {
  assert.deepEqual(publicProviderStatus({}), { google: { enabled: false }, apple: { enabled: false } });
  assert.equal(publicProviderStatus(env).google.enabled, true);
  assert.equal(providerConfig('unknown', env), null);
  assert.equal(providerConfig('google', { ...env, SAAS_GOOGLE_REDIRECT_URI: 'https://evil.test/different' }), null);
  assert.equal(providerConfig('google', { ...env, FRONTEND_URL: 'https://user:pass@studio.example.com' }), null);
  const appleKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const apple = { ...env, SAAS_APPLE_CLIENT_ID: 'com.example.studio.web', SAAS_APPLE_TEAM_ID: 'ABCDEFGHIJ', SAAS_APPLE_KEY_ID: '0123456789', SAAS_APPLE_PRIVATE_KEY: appleKey, SAAS_APPLE_REDIRECT_URI: 'https://api.example.com/api/saas/oauth/apple/callback' };
  assert.equal(publicProviderStatus(apple).apple.enabled, true);
  assert.equal(providerConfig('apple', { ...apple, SAAS_APPLE_REDIRECT_URI: 'https://127.0.0.1/api/saas/oauth/apple/callback' }), null);
  assert.equal(providerConfig('apple', { ...apple, SAAS_APPLE_REDIRECT_URI: 'http://localhost/api/saas/oauth/apple/callback' }), null);
  assert.equal(providerConfig('apple', { ...apple, SAAS_APPLE_PRIVATE_KEY: 'not a private key' }), null);
});
test('actual signed Google and Apple tokens validate only trusted claims and verified email', async () => {
  let requests = 0;
  const verify = createIdTokenVerifier({ now: () => time, fetchImpl: async url => { assert.ok(['https://www.googleapis.com/oauth2/v3/certs', 'https://appleid.apple.com/auth/keys'].includes(url)); requests++; return jsonResponse({ keys: [jwk] }); } });
  const profile = await verify('google', token({ given_name: 'Asha', family_name: 'Rao' }), verification);
  assert.deepEqual(profile, { subject: 'provider-person-1', email: 'owner@example.com', firstName: 'Asha', lastName: 'Rao' });
  assert.equal((await verify('apple', token({ iss: 'https://appleid.apple.com', email_verified: 'true' }), verification)).subject, profile.subject);
  for (const claims of [
    { iss: 'https://evil.test' }, { aud: 'another-client' }, { aud: [clientId, 'other'] }, { azp: 'other' },
    { exp: time / 1000 - 1 }, { iat: time / 1000 + 120 }, { iat: time / 1000 - 800 },
    { nonce: 'wrong' }, { nonce: undefined }, { email_verified: 'false' }, { email_verified: false },
    { email: 'not-an-email' }, { sub: '' },
  ]) await assert.rejects(verify('google', token(claims), verification), error => error.status === 401);
  assert.equal(requests, 2, 'JWKS cache is bounded and reused for known signing keys');
});
test('wrong signatures, unknown signing keys and algorithm substitution are rejected', async () => {
  const verify = createIdTokenVerifier({ now: () => time, fetchImpl: async () => jsonResponse({ keys: [jwk] }) });
  const rogue = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verify('google', token({}, { key: rogue }), verification), error => error.status === 401);
  await assert.rejects(verify('google', token({}, { kid: 'unknown-key' }), verification), error => error.status === 401);
  await assert.rejects(verify('google', token({}, { key: 'test-only-hmac', algorithm: 'HS256' }), verification), error => error.status === 401);
});

const copy = value => value == null ? value : structuredClone(value);
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(item => matches(row, item));
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$exists' in expected) return (actual !== undefined) === expected.$exists;
      if ('$gt' in expected) return actual > expected.$gt;
      if ('$lte' in expected) return actual <= expected.$lte;
    }
    return String(actual) === String(expected);
  });
}
function update(row, changes) { Object.assign(row, copy(changes.$set || {})); Object.keys(changes.$unset || {}).forEach(key => delete row[key]); }
function query(value) { return { select() { return this; }, sort() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } }; }
function store(seed = []) {
  const rows = copy(seed);
  return { rows,
    create: async data => {
      if (data.email && rows.some(row => row.email === data.email || (data.oauthProvider && row.oauthProvider === data.oauthProvider && row.oauthSubject === data.oauthSubject))) throw Object.assign(new Error('Duplicate'), { code: 11000 });
      const row = { _id: 'record-' + rows.length, state: 'active', ...copy(data) }; rows.push(row); return copy(row);
    },
    find: filter => query(rows.filter(row => matches(row, filter)).map(copy)),
    findOne: filter => query(copy(rows.find(row => matches(row, filter)) || null)),
    exists: async filter => rows.some(row => matches(row, filter)),
    findOneAndUpdate: (filter, changes) => { const row = rows.find(row => matches(row, filter)); if (row) update(row, changes); return query(copy(row || null)); },
    updateOne: async (filter, changes) => { const row = rows.find(row => matches(row, filter)); if (row) update(row, changes); return { modifiedCount: Number(Boolean(row)) }; },
  };
}
function fixture({ environment = env, account, member = false, verifyFailure = false } = {}) {
  let clock = time, sequence = 0, provisions = 0, sessions = 0;
  const models = { OAuthFlow: store(), Account: store(account ? [account] : []), Membership: store(member ? [{ _id: 'member-1', accountId: account._id, workspaceId: 'workspace-1', state: 'active', role: 'owner' }] : []), Workspace: store(member ? [{ _id: 'workspace-1', state: 'active' }] : []) };
  const service = {
    text(value, field) { if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error('Enter ' + field), { status: 400 }); return value.trim(); },
    async provisionWorkspace(person, name) { provisions++; await Promise.resolve(); const workspace = await models.Workspace.create({ name }); const membership = await models.Membership.create({ accountId: person._id, workspaceId: workspace._id, role: 'owner' }); return { workspace, membership }; },
    async issueSession(person, workspace) { sessions++; return { token: 'test-session', user: { role: 'admin', email: person.email, workspace: { id: workspace._id } } }; },
  };
  const calls = [];
  const auth = createSocialAuth({ models, service, env: environment, now: () => clock, tokenFactory: () => (++sequence).toString(16).padStart(64, '0'), fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse({ id_token: 'provider-token-never-stored', access_token: 'not-retained', refresh_token: 'not-retained' }); }, verifyIdToken: async (_provider, _token, verification) => { assert.match(verification.nonceHash, /^[a-f\d]{64}$/); if (verifyFailure) throw Object.assign(new Error('Identity verification failed.'), { status: 401 }); return { subject: 'provider-person-1', email: 'owner@example.com', firstName: 'Asha', lastName: '' }; } });
  return { auth, models, calls, service, advance: ms => { clock += ms; }, counts: () => ({ provisions, sessions }) };
}
async function ready(f) {
  const started = await f.auth.start('google', 'signup');
  const state = new URL(started.authorizationUrl).searchParams.get('state');
  const finished = await f.auth.callback('google', { state, code: 'authorization-code' });
  return { started, finished, body: { ticket: finished.ticket, browserProof: started.browserProof } };
}
test('start binds state, nonce, browser proof and S256 PKCE without requesting Gmail/Calendar scopes', async () => {
  const f = fixture(), started = await f.auth.start('google', 'signup'), url = new URL(started.authorizationUrl), flow = f.models.OAuthFlow.rows[0];
  assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), crypto.createHash('sha256').update(flow.pkceVerifier).digest('base64url'));
  assert.equal(flow.stateHash, digest(url.searchParams.get('state'))); assert.equal(flow.proofHash, digest(started.browserProof));
  assert.equal(flow.nonceHash, digest(url.searchParams.get('nonce'))); assert.ok(flow.expiresAt > time);
  assert.equal(JSON.stringify(flow).includes(started.browserProof), false);
});
test('callback atomically consumes state, binds provider, expires and never stores provider tokens', async () => {
  const f = fixture(), { started, finished } = await ready(f), state = new URL(started.authorizationUrl).searchParams.get('state');
  assert.equal(finished.redirect, 'https://studio.example.com/studio-os/auth/callback#ticket=' + finished.ticket);
  assert.equal(f.models.OAuthFlow.rows[0].status, 'ready');
  assert.equal(f.models.OAuthFlow.rows[0].pkceVerifier, undefined);
  assert.equal(JSON.stringify(f.models.OAuthFlow.rows).includes('not-retained'), false);
  assert.equal(JSON.stringify(f.models.OAuthFlow.rows).includes('provider-token-never-stored'), false);
  assert.equal(new URLSearchParams(f.calls[0].options.body).get('grant_type'), 'authorization_code');
  await assert.rejects(f.auth.callback('google', { state, code: 'replay' }), error => error.status === 401);
  const expired = fixture(), start = await expired.auth.start('google', 'signup'); expired.advance(11 * 60000);
  await assert.rejects(expired.auth.callback('google', { state: new URL(start.authorizationUrl).searchParams.get('state'), code: 'expired' }), error => error.status === 401);
  assert.equal(expired.calls.length, 0);
});
test('failed provider verification invalidates callback state and cannot produce a ticket', async () => {
  const f = fixture({ verifyFailure: true }), started = await f.auth.start('google', 'signup');
  await assert.rejects(f.auth.callback('google', { state: new URL(started.authorizationUrl).searchParams.get('state'), code: 'code' }), error => error.status === 401);
  assert.equal(f.models.OAuthFlow.rows[0].status, 'failed'); assert.equal(f.models.OAuthFlow.rows[0].ticketHash, undefined);
});
test('Apple exchange uses ES256 client credentials and trusts token email rather than callback user JSON', async () => {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const appleEnv = { ...env, SAAS_APPLE_CLIENT_ID: 'com.example.studio.web', SAAS_APPLE_TEAM_ID: 'ABCDEFGHIJ', SAAS_APPLE_KEY_ID: '0123456789', SAAS_APPLE_PRIVATE_KEY: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), SAAS_APPLE_REDIRECT_URI: 'https://api.example.com/api/saas/oauth/apple/callback' };
  const f = fixture({ environment: appleEnv });
  const start = await f.auth.start('apple', 'signup'), authUrl = new URL(start.authorizationUrl);
  assert.equal(authUrl.origin, 'https://appleid.apple.com'); assert.equal(authUrl.searchParams.get('response_mode'), 'form_post');
  const callback = await f.auth.callback('apple', { state: authUrl.searchParams.get('state'), code: 'apple-code', user: JSON.stringify({ email: 'forged@example.com', name: { firstName: 'Asha\u0000', lastName: '' } }) });
  const fields = new URLSearchParams(f.calls[0].options.body);
  assert.equal(f.calls[0].url, 'https://appleid.apple.com/auth/token');
  const credential = jwt.verify(fields.get('client_secret'), pair.publicKey, { algorithms: ['ES256'], audience: 'https://appleid.apple.com', issuer: 'ABCDEFGHIJ', subject: 'com.example.studio.web', clockTimestamp: time / 1000 });
  assert.equal(credential.exp - credential.iat, 300); assert.equal(fields.has('code_verifier'), false);
  const result = await f.auth.complete({ ticket: callback.ticket, browserProof: start.browserProof }, {});
  assert.equal(result.profile.email, 'owner@example.com'); assert.equal(result.profile.firstName, 'Asha');
  const repeat = await f.auth.start('apple', 'signup');
  const repeated = await f.auth.callback('apple', { state: new URL(repeat.authorizationUrl).searchParams.get('state'), code: 'repeat-apple-code' });
  assert.equal((await f.auth.complete({ ticket: repeated.ticket, browserProof: repeat.browserProof }, {})).needsWorkspace, true, 'Missing repeat-consent name does not block onboarding');
});
test('completion requires initiating browser proof and does not accept client identity fields', async () => {
  const f = fixture(), { body } = await ready(f);
  await assert.rejects(f.auth.complete({ ...body, browserProof: 'f'.repeat(64) }, {}), error => error.status === 401);
  assert.deepEqual(await f.auth.complete({ ...body, email: 'attacker@example.com', workspaceId: 'other' }, {}), { needsWorkspace: true, profile: { email: 'owner@example.com', firstName: 'Asha', lastName: '' } });
  assert.deepEqual(f.counts(), { provisions: 0, sessions: 0 });
  const session = await f.auth.complete({ ...body, studioName: 'Sample Studio', firstName: 'Asha', lastName: '', email: 'attacker@example.com', role: 'admin' }, {});
  assert.equal(session.user.email, 'owner@example.com'); assert.deepEqual(f.counts(), { provisions: 1, sessions: 1 });
  assert.equal(f.models.Account.rows[0].oauthSubject, 'provider-person-1'); assert.match(f.models.Account.rows[0].passwordHash, /^\$2/);
  await assert.rejects(f.auth.complete(body, {}), error => error.status === 401);
});
test('same email on password or other-provider account is never linked automatically', async () => {
  for (const extra of [{}, { oauthProvider: 'apple', oauthSubject: 'apple-person' }]) {
    const f = fixture({ account: { _id: 'existing', email: 'owner@example.com', state: 'active', ...extra } }), { body } = await ready(f);
    await assert.rejects(f.auth.complete(body, {}), error => error.status === 409);
    assert.deepEqual(f.counts(), { provisions: 0, sessions: 0 });
  }
});
test('provider subject remains identity when email changes; existing users sign in with registration disabled', async () => {
  const settings = { ...env }, f = fixture({ environment: settings, account: { _id: 'existing', email: 'original@example.com', state: 'active', oauthProvider: 'google', oauthSubject: 'provider-person-1' }, member: true });
  const { body } = await ready(f); settings.SAAS_SIGNUP_ENABLED = 'false';
  assert.equal((await f.auth.complete(body, {})).user.email, 'original@example.com'); assert.equal(f.counts().provisions, 0);
  assert.ok((await f.auth.start('google', 'login')).authorizationUrl);
  await assert.rejects(f.auth.start('google', 'signup'), error => error.status === 503);
  const disabled = fixture({ environment: { ...env, SAAS_SIGNUP_ENABLED: 'false' } });
  const start = await disabled.auth.start('google', 'login'), callback = await disabled.auth.callback('google', { state: new URL(start.authorizationUrl).searchParams.get('state'), code: 'code' });
  await assert.rejects(disabled.auth.complete({ ticket: callback.ticket, browserProof: start.browserProof }, {}), error => error.status === 403);
});
test('concurrent completion and separate browser flows create only one initial studio', async () => {
  const f = fixture(), first = await ready(f), second = await ready(f), details = { studioName: 'One Studio', firstName: 'Asha' };
  const results = await Promise.allSettled([
    f.auth.complete({ ...first.body, ...details }, {}), f.auth.complete({ ...first.body, ...details }, {}), f.auth.complete({ ...second.body, ...details }, {}),
  ]);
  assert.equal(f.counts().provisions, 1); assert.equal(f.models.Account.rows.length, 1);
  assert.ok(results.some(row => row.status === 'fulfilled')); assert.ok(results.some(row => row.status === 'rejected'));
  assert.equal(f.models.Account.rows[0].socialProvisioningToken, undefined);
});
test('completion rejects expired tickets even before MongoDB TTL cleanup', async () => {
  const f = fixture(), { body } = await ready(f); f.advance(11 * 60000);
  await assert.rejects(f.auth.complete(body, {}), error => error.status === 401); assert.equal(f.counts().sessions, 0);
});
test('disabled social accounts cannot issue sessions or create another studio', async () => {
  const f = fixture({ account: { _id: 'disabled', email: 'owner@example.com', state: 'disabled', oauthProvider: 'google', oauthSubject: 'provider-person-1' }, member: true }), { body } = await ready(f);
  await assert.rejects(f.auth.complete(body, {}), error => error.status === 403); assert.deepEqual(f.counts(), { provisions: 0, sessions: 0 });
});
test('OAuth flow metadata remains in the global identity database, never a studio database', async () => {
  const { Mongoose } = require('mongoose');
  const mongoose = new Mongoose();
  const { installTenantModels } = require('../saas/tenantModels');
  const { runInWorkspace } = require('../saas/tenantContext');
  const installation = installTenantModels(mongoose);
  const flow = mongoose.connection.model('SaaSOAuthFlow', new mongoose.Schema({ stateHash: String }));
  const workspace = { _id: 'a'.repeat(24), databaseName: 'studio_' + 'a'.repeat(24) };
  await runInWorkspace(workspace, async () => {
    assert.equal(mongoose.model('SaaSOAuthFlow'), flow);
    const connection = mongoose.connection.useDb(workspace.databaseName, { useCache: true });
    installation.ensureWorkspaceModels(connection);
    assert.equal(connection.models.SaaSOAuthFlow, undefined);
    assert.equal(flow.findOne().model.db, mongoose.connection);
  });
});
