const test = require('node:test');
const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');
const { forEachWorkspace } = require('../saas/workers');

const studio = character => { const id = character.repeat(24); return { _id: id, state: 'active', databaseName: `studio_${id}`, subscriptionStatus: 'trialing' }; };

test('disabled SaaS runs the legacy job once in a cleared context and never queries the registry', async () => {
  const storage = new AsyncLocalStorage(), calls = [];
  const outcomes = await storage.run(studio('a'), () => forEachWorkspace(async workspace => { await Promise.resolve(); calls.push([workspace, storage.getStore()]); }, { env: {}, Workspace: { find() { throw new Error('Must not load registry'); } }, runInWorkspace: (workspace, fn) => storage.run(workspace, fn) }));
  assert.deepEqual(calls, [[null, null]]);
  assert.deepEqual(outcomes, [{ workspaceId: 'legacy', ok: true }]);
});

test('jobs run sequentially in isolated provisioned databases, including trial studios', async () => {
  const a = studio('a'), b = studio('b'), storage = new AsyncLocalStorage(), scopes = [];
  const outcomes = await forEachWorkspace(async workspace => { await Promise.resolve(); assert.equal(storage.getStore(), workspace); scopes.push(workspace?._id || 'legacy'); }, {
    env: { SAAS_ENABLED: 'true' }, Workspace: { find: async filter => { assert.deepEqual(filter, { state: 'active' }); return [a, { ...a }, { ...b, state: 'provisioning' }, { ...b, databaseName: 'legacy' }, b]; } }, runInWorkspace: (workspace, fn) => storage.run(workspace, fn),
  });
  assert.deepEqual(scopes, ['legacy', a._id, b._id]);
  assert.equal(outcomes.every(row => row.ok), true);
  assert.equal(storage.getStore(), undefined);
});

test('a failed studio job does not stop another studio and logs contain no error secrets', async () => {
  const a = studio('a'), b = studio('b'), calls = [], logs = [];
  const outcomes = await forEachWorkspace(async workspace => { calls.push(workspace?._id || 'legacy'); if (!workspace || workspace._id === a._id) throw new Error('private credentials and client information'); }, { env: { SAAS_ENABLED: 'true' }, Workspace: { find: async () => [a, b] }, runInWorkspace: (_workspace, fn) => fn(), logger: { error: (...args) => logs.push(args) } });
  assert.deepEqual(calls, ['legacy', a._id, b._id]);
  assert.deepEqual(outcomes.map(row => row.ok), [false, false, true]);
  assert.equal(logs.length, 2);
  assert.equal(JSON.stringify(logs).includes('private credentials'), false);
});

test('a registry outage preserves legacy work and yields an observable failure', async () => {
  const calls = [], logs = [];
  const outcomes = await forEachWorkspace(workspace => { calls.push(workspace); }, { env: { SAAS_ENABLED: 'true' }, Workspace: { find: async () => { throw new Error('private registry URI'); } }, runInWorkspace: (_workspace, fn) => fn(), logger: { error: (...args) => logs.push(args) } });
  assert.deepEqual(calls, [null]);
  assert.deepEqual(outcomes, [{ workspaceId: 'legacy', ok: true }, { workspaceId: 'registry', ok: false }]);
  assert.equal(JSON.stringify(logs).includes('private registry URI'), false);
});
