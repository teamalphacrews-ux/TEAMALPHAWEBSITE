import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileWorkspaceDataEpoch } from '../src/utils/workspaceDataEpoch.js';
const memory = initial => {
  const map = new Map(Object.entries(initial));
  return { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
};
test('replacement generation clears only that account drafts and stale preference patches', async () => {
  const storage = memory({ 'studio-data-epoch:owner': '0', 'teamalpha-studio-preferences:owner': 'old', 'teamalpha-studio-preferences:owner:pending': 'old', 'teamalpha-studio-preferences:other': 'keep' }), purged = [];
  await reconcileWorkspaceDataEpoch({ id: 'owner', workspaceDataVersion: 1 }, { storage, purgeDrafts: async scope => purged.push(scope), scope: 'owner-scope' });
  assert.deepEqual(purged, ['owner-scope']); assert.equal(storage.getItem('teamalpha-studio-preferences:owner:pending'), null); assert.equal(storage.getItem('teamalpha-studio-preferences:other'), 'keep'); assert.equal(storage.getItem('studio-data-epoch:owner'), '1');
  await reconcileWorkspaceDataEpoch({ id: 'owner', workspaceDataVersion: 1 }, { storage, purgeDrafts: async scope => purged.push(scope), scope: 'owner-scope' });
  assert.equal(purged.length, 1);
});
test('first sign-in to replaced data purges old drafts even when session metadata expired', async () => {
  const storage = memory({}), purged = [];
  await reconcileWorkspaceDataEpoch({ id: 'owner', workspaceDataVersion: 3 }, { storage, purgeDrafts: async scope => purged.push(scope), scope: 'owner-scope' });
  assert.deepEqual(purged, ['owner-scope']);
});
