const test = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const { createOAuthStateService } = require('../utils/oauthState');
const { createGmailOAuthHandlers } = require('../utils/gmailOAuth');
const { GMAIL_SCOPE, gmailConfiguration, gmailSetupChecks, sealTokens, openTokens, listOptions, messageDetail, createGmailService, safeGmailError } = require('../services/gmailService');

const id = '507f1f77bcf86cd799439011', other = '507f1f77bcf86cd799439012';
const env = { NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'test-id', GOOGLE_CLIENT_SECRET: 'private-client-secret', GMAIL_REDIRECT_URI: 'https://api.example.test/api/integrations/gmail/callback', FRONTEND_URL: 'https://studio.example.test', VAULT_SECRET: '12345678901234567890123456789012' };
const identity = { id, role: 'admin' };
const credentials = { access_token: 'private-access', refresh_token: 'private-refresh', expiry_date: Date.now() + 3600000 };
const tokens = { ...credentials, scope: GMAIL_SCOPE };
const response = () => ({ headers: {}, cookies: [], statusCode: 200,
  set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }, cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
  clearCookie() {}, redirect(url) { this.location = url; return this; } });
function fixture() {
  const records = new Map(), connections = new Map(), updates = [], logs = [];
  const admin = { _id: id, role: 'admin' };
  const User = { findOne: async query => query._id === id && query.role === admin.role ? admin : null };
  const query = record => ({ select: async () => record ? { ...record } : null, then(resolve, reject) { return Promise.resolve(record ? { ...record } : null).then(resolve, reject); } });
  const matches = (record, filter) => record && ['_id', 'userId', 'email', 'tokenEnvelope'].every(key => filter[key] === undefined || record[key] === filter[key]);
  const Connection = {
    findOne: filter => query(connections.get(String(filter.userId))),
    findOneAndUpdate: async (filter, update, options) => {
      const current = connections.get(String(filter.userId));
      if ((current && !matches(current, filter)) || (!current && !options.upsert)) return null;
      const next = { _id: filter.userId, userId: filter.userId, ...current, ...update.$set };
      connections.set(String(filter.userId), next); updates.push(update); return next;
    },
    updateOne: async (filter, update) => { const current = connections.get(String(filter.userId)); if (matches(current, filter)) { Object.assign(current, update.$set); updates.push(update); } },
    deleteOne: async filter => connections.delete(String(filter.userId)),
  };
  const store = {
    create: async record => { assert.ok(!records.has(record._id)); records.set(record._id, record); },
    findOneAndDelete: async filter => {
      const record = records.get(filter._id);
      if (!record || record.kind !== filter.kind || (filter.browserHash && record.browserHash !== filter.browserHash) || !(record.expiresAt > filter.expiresAt.$gt)) return null;
      records.delete(filter._id); return record;
    },
    deleteMany: async filter => { for (const [key, value] of records) if (String(value.userId) === filter.userId) records.delete(key); },
  };
  return { records, connections, updates, logs, User, Connection, store, admin };
}
function oauthFixture(extra = {}) {
  const f = fixture(), exchanges = [], profiles = [];
  const makeClient = config => {
    const oauth = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    oauth.getToken = async options => { exchanges.push(options); return { tokens: { ...tokens } }; };
    return oauth;
  };
  const handlers = createGmailOAuthHandlers({ ...f, env, makeClient, getProfile: async () => { profiles.push(true); return { emailAddress: 'owner@example.test' }; },
    logger: { warn: (...args) => f.logs.push(args) }, ...extra });
  return { ...f, handlers, exchanges, profiles };
}
async function opened(f) {
  const start = response(); await f.handlers.start({ user: identity }, start);
  const beginUrl = new URL(start.body.url), begin = response();
  await f.handlers.begin({ query: { ticket: beginUrl.searchParams.get('ticket') } }, begin);
  const state = new URL(begin.location).searchParams.get('state');
  return { start, begin, request: { query: { state, code: 'private-authorization-code' }, headers: { cookie: begin.cookies[0].name + '=' + begin.cookies[0].value } } };
}

test('Gmail configuration is independent from Calendar callback and requires encryption', () => {
  const config = gmailConfiguration(env);
  assert.equal(config.redirectUri, env.GMAIL_REDIRECT_URI);
  assert.equal(config.cookieName, '__Host-ta_gmail_oauth');
  for (const update of [{ GMAIL_REDIRECT_URI: '' }, { GMAIL_REDIRECT_URI: 'https://api.example.test/api/auth/google/callback' }, { FRONTEND_URL: 'http://studio.example.test' }, { VAULT_SECRET: '' }]) assert.throws(() => gmailConfiguration({ ...env, ...update }));
  assert.equal(gmailConfiguration({ ...env, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', GMAIL_CLIENT_ID: 'gmail-id', GMAIL_CLIENT_SECRET: 'gmail-secret' }).clientId, 'gmail-id');
  assert.throws(() => gmailConfiguration({ ...env, GMAIL_CLIENT_ID: 'gmail-only-id' }));
});

test('Gmail credentials use authenticated encryption bound to the administrator', () => {
  const sealed = sealTokens(credentials, id, env);
  assert.doesNotMatch(sealed, /private-access|private-refresh/);
  assert.deepEqual(openTokens(sealed, id, env), credentials);
  assert.throws(() => openTokens(sealed, other, env));
  const parts = sealed.split('.'); parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
  assert.throws(() => openTokens(parts.join('.'), id, env));
});

test('Gmail setup diagnostics show readiness without exposing credentials', () => {
  assert.ok(gmailSetupChecks(env).every(check => check.ready));
  const incomplete = gmailSetupChecks({ ...env, GMAIL_REDIRECT_URI: '', VAULT_SECRET: '' });
  assert.equal(incomplete.find(check => check.id === 'callback').ready, false);
  assert.equal(incomplete.find(check => check.id === 'encryption').ready, false);
  assert.doesNotMatch(JSON.stringify(incomplete), /private-client-secret|12345678901234567890123456789012|test-id/);
});

test('expired Gmail access is reported as reconnect needed while retaining account identity', async () => {
  const f = fixture();
  f.connections.set(id, { userId: id, email: 'owner@example.test', lastErrorCode: 'GMAIL_RECONNECT', lastError: 'Reconnect Gmail.' });
  const status = await createGmailService({ Connection: f.Connection, env }).status(id);
  assert.equal(status.connected, false);
  assert.equal(status.needsReconnect, true);
  assert.equal(status.hasConnection, true);
  assert.equal(status.email, 'owner@example.test');
  f.connections.get(id).lastErrorCode = 'GMAIL_RATE_LIMIT';
  assert.equal((await createGmailService({ Connection: f.Connection, env }).status(id)).connected, true);
});

test('Gmail consent is read-only and uses its own bound cookie with PKCE', async () => {
  const f = oauthFixture(), flow = await opened(f), consent = new URL(flow.begin.location);
  assert.equal(consent.searchParams.get('scope'), GMAIL_SCOPE);
  assert.equal(consent.searchParams.get('access_type'), 'offline');
  assert.equal(consent.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(flow.begin.cookies[0].options.secure, true);
  assert.equal(flow.begin.cookies[0].options.httpOnly, true);
  assert.equal(flow.begin.cookies[0].options.sameSite, 'lax');
  assert.equal(flow.begin.cookies[0].options.path, '/');
  assert.equal(flow.begin.cookies[0].options.domain, undefined);
  const result = response(); await f.handlers.callback(flow.request, result);
  assert.equal(result.location, 'https://studio.example.test/admin/email?gmail=connected');
  assert.match(f.exchanges[0].codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.connections.size, 1);
  const again = response(); await f.handlers.callback(flow.request, again);
  assert.match(again.location, /gmail=error/);
  assert.equal(f.exchanges.length, 1);
});

test('Calendar tickets and cookies cannot authorize the Gmail connection', async () => {
  const f = oauthFixture(), calendar = fixture();
  const calendarState = createOAuthStateService({ User: calendar.User, store: calendar.store });
  const ticket = await calendarState.issue(identity), result = response();
  await f.handlers.begin({ query: { ticket } }, result);
  assert.match(result.location, /gmail=error/);
  assert.equal(calendar.records.size, 1);
  const flow = await opened(f), wrong = response();
  await f.handlers.callback({ ...flow.request, headers: { cookie: flow.request.headers.cookie.replace('__Host-ta_gmail_oauth', '__Host-ta_google_oauth') } }, wrong);
  assert.match(wrong.location, /gmail=error/);
  assert.equal(f.exchanges.length, 0);
  const right = response(); await f.handlers.callback(flow.request, right);
  assert.match(right.location, /gmail=connected/);
});

test('missing Gmail grants fail before mailbox lookup or persistence', async () => {
  const f = oauthFixture({ makeClient: () => ({ generateAuthUrl: options => 'https://accounts.google.com/?' + new URLSearchParams({ state: options.state }), getToken: async () => ({ tokens: { ...tokens, scope: 'https://www.googleapis.com/auth/calendar.events' } }), setCredentials() {} }) });
  const flow = await opened(f), result = response(); await f.handlers.callback(flow.request, result);
  assert.match(result.location, /gmail=error&step=permission/);
  assert.equal(f.profiles.length, 0); assert.equal(f.connections.size, 0);
});

test('Gmail callback failures expose no provider credentials or authorization codes in diagnostics', async () => {
  const secret = 'do-not-log-client-secret-or-auth-code';
  const f = oauthFixture({ makeClient: () => ({ generateAuthUrl: options => 'https://accounts.google.com/?' + new URLSearchParams({ state: options.state }), getToken: async () => { throw { message: secret, response: { status: 401, data: { error: 'invalid_client', error_description: secret } } }; } }) });
  const flow = await opened(f), result = response(); await f.handlers.callback(flow.request, result);
  assert.match(result.location, /step=token/);
  assert.match(JSON.stringify(f.logs), /invalid_client/);
  assert.doesNotMatch(JSON.stringify(f.logs), new RegExp(secret + '|private-authorization-code|private-client-secret'));
});

test('Gmail callback rechecks administrator authority and does not reuse another account refresh token', async () => {
  for (const scenario of ['demoted', 'other-account']) {
    const f = oauthFixture({ getProfile: async () => ({ emailAddress: scenario === 'other-account' ? 'another@example.test' : 'owner@example.test' }) });
    // Omit the new refresh token so only same-account reuse could be permitted.
    f.connections.set(id, { _id: id, userId: id, email: 'owner@example.test', tokenEnvelope: sealTokens(credentials, id, env) });
    const old = f.connections.get(id).tokenEnvelope;
    const flow = await opened(f);
    if (scenario === 'demoted') f.admin.role = 'client';
    const original = f.handlers;
    if (scenario === 'other-account') {
      const oauth = new google.auth.OAuth2('id', 'secret', env.GMAIL_REDIRECT_URI);
      oauth.getToken = async () => ({ tokens: { access_token: 'new-access', scope: GMAIL_SCOPE } });
      f.handlers = createGmailOAuthHandlers({ ...f, env, makeClient: () => oauth, getProfile: async () => ({ emailAddress: 'another@example.test' }), logger: { warn() {} } });
    }
    const result = response(); await (scenario === 'demoted' ? original : f.handlers).callback(flow.request, result);
    assert.match(result.location, /gmail=error/); assert.equal(f.connections.get(id).tokenEnvelope, old);
  }
});

test('Gmail list input is bounded and uses only the authenticated mailbox', () => {
  assert.deepEqual(listOptions({ folder: 'sent', q: 'from:couple@example.test', pageToken: 'page2' }), { userId: 'me', maxResults: 25, includeSpamTrash: false, labelIds: ['SENT'], q: 'from:couple@example.test', pageToken: 'page2' });
  assert.equal(listOptions({ folder: 'all' }).labelIds, undefined);
  for (const query of [{ folder: 'someone-else' }, { q: 'a'.repeat(501) }, { q: ['not-string'] }, { pageToken: 'a'.repeat(2049) }]) assert.throws(() => listOptions(query));
});

test('message previews are plain text with bounded bodies and no active HTML content', () => {
  const html = '<script>alert(1)</script><img src="https://tracker.example.test">';
  const result = messageDetail({ id: 'abc123', threadId: 'def456', snippet: 'Safe preview', payload: { headers: [{ name: 'Subject', value: html }], parts: [{ mimeType: 'text/html', body: { data: Buffer.from(html).toString('base64url') } }, { mimeType: 'text/plain', body: { data: Buffer.from('x'.repeat(150000)).toString('base64url') } }, { filename: '../../file.pdf', mimeType: 'application/pdf', body: { attachmentId: 'private-attachment-id', size: 250 } }] } }, 'owner@example.test');
  assert.equal(result.body.length, 100000); assert.equal(result.truncated, true);
  assert.doesNotMatch(result.body, /script|tracker/);
  assert.equal(result.attachments[0].name, '../../file.pdf');
  assert.equal(result.attachments[0].attachmentId, undefined);
  assert.match(result.gmailUrl, /^https:\/\/mail\.google\.com\//);
  const formatted = messageDetail({ id: 'abc123', payload: { mimeType: 'text/html', body: { data: Buffer.from('<head><style>secret-style</style></head><script>private-script</script><p>Hello &amp; welcome</p><p>Your wedding plans.</p><img src="https://tracking.example.test/pixel">').toString('base64url') } } }, 'owner@example.test');
  assert.match(formatted.body, /Hello & welcome\nYour wedding plans/);
  assert.doesNotMatch(formatted.body, /tracking|script|secret-style|<img/);
});

test('mail reads are per-administrator, bounded and never store messages or return credentials', async () => {
  const f = fixture();
  f.connections.set(id, { _id: id, userId: id, email: 'owner@example.test', tokenEnvelope: sealTokens(credentials, id, env), connectedAt: new Date() });
  const calls = [];
  const service = createGmailService({ ...f, env, makeOAuth: () => ({ credentials: {}, setCredentials(value) { this.credentials = value; } }), makeGmail: () => ({ users: { messages: {
    list: async options => { calls.push(options); return { data: { messages: [{ id: 'abc123' }], nextPageToken: 'next', resultSizeEstimate: 500 } }; },
    get: async options => { calls.push(options); return { data: { id: options.id, internalDate: '1720000000000', payload: { headers: [{ name: 'Subject', value: 'Wedding plans' }] }, snippet: 'Private mail preview' } }; },
  } } }) });
  const result = await service.list(id, { folder: 'inbox' });
  assert.equal(result.messages[0].subject, 'Wedding plans'); assert.equal(result.nextPageToken, 'next');
  assert.equal(calls[0].userId, 'me'); assert.equal(calls[1].format, 'metadata');
  assert.doesNotMatch(JSON.stringify(result), /private-access|private-refresh|tokenEnvelope/);
  assert.doesNotMatch(JSON.stringify(await service.status(id)), /private-access|private-refresh|tokenEnvelope/);
  assert.doesNotMatch(JSON.stringify(f.updates), /Wedding plans|Private mail preview/);
  await assert.rejects(service.list(other, {}), /Connect your Gmail account/);
});

test('provider error details cannot leak tokens through the mail API', () => {
  const error = safeGmailError({ response: { status: 401, data: { error: 'invalid_grant', private: 'private-access' } }, message: 'private-client-secret' });
  assert.equal(error.code, 'GMAIL_RECONNECT'); assert.doesNotMatch(error.message, /private-/);
});

test('Gmail routes require current administrator access and ignore mailbox-owner overrides', async t => {
  const express = require('express');
  const { createGmailRouter } = require('../routes/gmailRoutes');
  const f = fixture(), reads = [];
  f.connections.set(id, { _id: id, userId: id }); f.connections.set(other, { _id: other, userId: other });
  f.records.set('pending', { userId: id }); f.records.set('other-pending', { userId: other });
  const authenticate = (req, res, next) => {
    if (!req.get('x-test-actor')) return res.status(401).json({ message: 'Sign in required' });
    req.user = { id: req.get('x-test-actor'), role: req.get('x-test-role') || 'admin' }; next();
  };
  const app = express();
  app.use(createGmailRouter({ ...f, env, authenticate,
    oauth: { begin: (_req, res) => res.status(400).end(), callback: (_req, res) => res.status(400).end(), start: (_req, res) => res.json({ connected: false }) },
    service: { status: async actor => ({ owner: actor }), list: async actor => { reads.push(actor); return { messages: [] }; }, detail: async actor => ({ owner: actor }) },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const [path, method] of [['/status','GET'],['/messages','GET'],['/messages/abc123','GET'],['/connect','POST'],['/disconnect','POST']]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
    assert.equal((await fetch(base + path, { method, headers: { 'x-test-actor': id, 'x-test-role': 'client' } })).status, 403);
  }
  const listed = await fetch(base + '/messages?userId=' + other, { headers: { 'x-test-actor': id } });
  assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'no-store'); assert.deepEqual(reads, [id]);
  const disconnected = await fetch(base + '/disconnect', { method: 'POST', headers: { 'x-test-actor': id } });
  assert.equal(disconnected.status, 200); assert.equal(f.connections.has(id), false); assert.equal(f.connections.has(other), true);
  assert.equal(f.records.has('pending'), false); assert.equal(f.records.has('other-pending'), true);
});
