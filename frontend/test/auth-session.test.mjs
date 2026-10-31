import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSessionToken, draftScopeToPurge, isCurrentSession, shouldRedirectExpiredSession, verifyStoredSession } from '../src/utils/authSession.js';

const id = '507f1f77bcf86cd799439011';
const session = { token: 'synthetic-session', user: { id, role: 'admin', firstName: 'Old name', workspace: { id: 'workspace-a' } } };
const response = (status, profile) => ({ status, ok: status >= 200 && status < 300, json: async () => profile });

test('session verification preserves workspace context and stores only verified public identity fields', async () => {
  let sent;
  const result = await verifyStoredSession(session, { api: 'https://api.example.test', fetcher: async (url, options) => {
    sent = { url, options }; return response(200, { _id: id, role: 'admin', firstName: 'Verified', lastName: '', email: 'owner@example.test', cloudPassword: 'never-store', googleRefreshToken: 'never-store' });
  } });
  assert.equal(sent.url, 'https://api.example.test/api/auth/me');
  assert.equal(sent.options.headers.Authorization, 'Bearer synthetic-session');
  assert.equal(result.status, 'valid');
  assert.equal(result.user.firstName, 'Verified');
  assert.deepEqual(result.user.workspace, session.user.workspace);
  assert.equal(result.user.cloudPassword, undefined);
  assert.equal(result.user.googleRefreshToken, undefined);
});

test('invalid or ended sessions expire but transient failures preserve the saved sign-in', async () => {
  for (const status of [401, 403]) assert.equal((await verifyStoredSession(session, { fetcher: async () => response(status) })).status, 'expired');
  for (const profile of [null, { _id: id, role: 'client' }, { _id: 'other-account', role: 'admin' }]) assert.equal((await verifyStoredSession(session, { fetcher: async () => response(200, profile) })).status, 'expired');
  for (const status of [429, 500, 503]) assert.equal((await verifyStoredSession(session, { fetcher: async () => response(status) })).status, 'unavailable');
  assert.equal((await verifyStoredSession(session, { fetcher: async () => { throw new TypeError('Network unavailable'); } })).status, 'unavailable');
  assert.equal(session.token, 'synthetic-session');
});

test('a delayed failure from a former sign-in cannot invalidate the current session', async () => {
  let resolve;
  const pending = verifyStoredSession(session, { fetcher: () => new Promise(done => { resolve = done; }) });
  const current = { ...session, token: 'new-session' };
  resolve(response(401));
  assert.equal((await pending).status, 'expired');
  assert.equal(isCurrentSession(session.token, current, 'new-session'), false);
  assert.equal(isCurrentSession(session.token, session, 'new-session'), false);
  assert.equal(isCurrentSession(session.token, session, session.token), true);
});

test('sample previews stay local, and missing sessions make no backend request', async () => {
  const fetcher = () => assert.fail('must not call the live backend');
  const preview = { ...session, user: { ...session.user, isPreview: true } };
  assert.deepEqual(await verifyStoredSession(preview, { fetcher }), { status: 'valid', user: preview.user });
  assert.equal((await verifyStoredSession({ token: null, user: null }, { fetcher })).status, 'missing');
  assert.equal(cleanSessionToken('"token"'), 'token');
  for (const value of ['', 'undefined', 'null', undefined]) assert.equal(cleanSessionToken(value), null);
});

test('expired administrator sessions redirect protected pages but leave public client links open', async () => {
  const result = await verifyStoredSession(session, { fetcher: async () => response(401) });
  assert.equal(result.status, 'expired');
  for (const path of ['/admin', '/admin/calendar', '/admin/invoices/new']) assert.equal(shouldRedirectExpiredSession(path), true);
  for (const path of ['/', '/auth', '/quote/public-token', '/invoice/public-token', '/administration']) assert.equal(shouldRedirectExpiredSession(path), false);
});

test('a stalled verification stops waiting, while navigation cancellation has a separate outcome', async () => {
  const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  assert.equal((await verifyStoredSession(session, { fetcher, timeoutMs: 5 })).status, 'unavailable');
  const controller = new AbortController();
  const pending = verifyStoredSession(session, { fetcher, signal: controller.signal });
  controller.abort();
  assert.equal((await pending).status, 'cancelled');
});

test('expiry in another tab preserves shared drafts until a deliberate logout or verified account switch', async () => {
  const ownerScope = id + ':legacy', otherScope = '507f1f77bcf86cd799439012:legacy';
  const purged = [];
  const apply = (nextScope, options) => { const scope = draftScopeToPurge(ownerScope, nextScope, options); if (scope) purged.push(scope); };
  // Token and user removals arrive as separate storage events in another tab.
  apply(''); apply('');
  // An intermediate account write is not proof of a successful new sign-in.
  apply(otherScope);
  assert.deepEqual(purged, []);
  const verified = await verifyStoredSession(session, { fetcher: async () => response(200, { _id: id, role: 'admin' }) });
  apply(ownerScope, { verified: verified.status === 'valid' });
  assert.deepEqual(purged, [], 're-signing into the same account keeps its drafts');
  apply(otherScope, { verified: true });
  assert.deepEqual(purged, [ownerScope], 'a verified account switch clears the prior account');
  assert.equal(draftScopeToPurge(ownerScope, '', { explicitLogout: true }), ownerScope);
  assert.equal(draftScopeToPurge('', '', { explicitLogout: true }), '');
});
