const test = require('node:test');
const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');
const { isShareToken, parseShareWorkspaceId, createShareToken, createPublicWorkspaceMiddleware } = require('../saas/publicTokens');

const id = 'a'.repeat(24), otherId = 'b'.repeat(24), secret = 'c'.repeat(64);
const workspace = { _id: id, state: 'active', databaseName: `studio_${id}`, subscriptionStatus: 'trialing' };
function response() {
  return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
}

test('share tokens validate complete prefix and secret without accepting malformed fallback tokens', () => {
  assert.equal(isShareToken(secret), true);
  assert.equal(parseShareWorkspaceId(secret), null);
  assert.equal(isShareToken(`${id}.${secret}`), true);
  assert.equal(parseShareWorkspaceId(`${id}.${secret}`), id);
  for (const bad of ['', null, {}, 'a'.repeat(63), `${id}.`, `z${id.slice(1)}.${secret}`, `${id}.${secret}extra`, `${id}..${secret}`, `${id.toUpperCase()}.${secret}`]) {
    assert.equal(isShareToken(bad), false);
    assert.equal(parseShareWorkspaceId(bad), null);
  }
});

test('generated tokens preserve legacy shape and include the active workspace identity', async () => {
  const { runInWorkspace } = require('../saas/tenantContext');
  const legacy = await runInWorkspace(null, () => createShareToken());
  const first = await runInWorkspace(workspace, () => createShareToken());
  const second = await runInWorkspace(workspace, () => createShareToken());
  assert.match(legacy, /^[a-f0-9]{64}$/);
  assert.equal(parseShareWorkspaceId(first), id);
  assert.equal(isShareToken(first), true);
  assert.notEqual(first, second);
});

test('public quote descendants enter the verified workspace and preserve the full token', async () => {
  const storage = new AsyncLocalStorage();
  const req = { originalUrl: `/api/quotes/${id}.${secret}/messages?after=1`, path: `/${id}.${secret}/messages` };
  const filters = [], res = response();
  const middleware = createPublicWorkspaceMiddleware({ Workspace: { findOne: async filter => { filters.push(filter); return workspace; } }, runInWorkspace: (value, fn) => storage.run(value, fn) });
  let selected;
  await middleware(req, res, async () => { await Promise.resolve(); selected = storage.getStore(); });
  assert.equal(selected, workspace);
  assert.equal(req.workspace, workspace);
  assert.equal(req.originalUrl, `/api/quotes/${id}.${secret}/messages?after=1`);
  assert.deepEqual(filters, [{ _id: id, state: 'active' }]);
});

test('legacy invoice links explicitly use the default context; unrelated routes are untouched', async () => {
  const storage = new AsyncLocalStorage(); let lookups = 0;
  const middleware = createPublicWorkspaceMiddleware({ Workspace: { findOne: async () => { lookups++; } }, runInWorkspace: (value, fn) => storage.run(value, fn) });
  await storage.run(workspace, async () => {
    await middleware({ path: `/public-invoices/${secret}` }, response(), () => assert.equal(storage.getStore(), null));
    await middleware({ path: '/api/studio/quotes' }, response(), () => assert.equal(storage.getStore(), workspace));
  });
  assert.equal(lookups, 0);
});

test('unavailable, unprovisioned or malformed workspace links never fall through to legacy data', async () => {
  for (const row of [null, { ...workspace, state: 'provisioning' }, { ...workspace, databaseName: 'legacy' }, { ...workspace, _id: otherId }]) {
    let entered = false, next = false;
    const middleware = createPublicWorkspaceMiddleware({ Workspace: { findOne: async () => row }, runInWorkspace: () => { entered = true; } });
    const res = response();
    await middleware({ path: `/api/public-invoices/${id}.${secret}` }, res, () => { next = true; });
    assert.equal(res.statusCode, 404); assert.equal(entered, false); assert.equal(next, false);
  }
  const res = response(); let called = false;
  await createPublicWorkspaceMiddleware({ Workspace: { findOne: async () => { called = true; } } })({ path: `/api/quotes/${id}.invalid` }, res, () => { called = true; });
  assert.equal(res.statusCode, 404); assert.equal(called, false);
});

test('registry failure returns retryable error without exposing details or executing a business handler', async () => {
  const res = response(); let called = false;
  await createPublicWorkspaceMiddleware({ Workspace: { findOne: async () => { throw new Error('private database URI'); } }, runInWorkspace: () => { called = true; } })({ path: `/api/quotes/${id}.${secret}/accept` }, res, () => { called = true; });
  assert.equal(res.statusCode, 503); assert.equal(called, false);
  assert.equal(JSON.stringify(res.body).includes('private'), false);
});
