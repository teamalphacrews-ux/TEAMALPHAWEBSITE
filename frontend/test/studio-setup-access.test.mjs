import test from 'node:test';
import assert from 'node:assert/strict';
import { afterStudioSetup, canReviewStudioSetup, changedSetupFields, requiresStudioSetup } from '../src/saas/studioSetupAccess.js';
import { verifyStoredSession } from '../src/utils/authSession.js';

const member = { id: 'member', role: 'admin', workspaceRole: 'staff', moduleAccess: ['contacts'], workspace: { id: 'studio', setupRequired: true } };

test('new workspaces require setup for both the owner and invited members; existing workspaces and the preview stay open', () => {
  assert.equal(requiresStudioSetup(member), true);
  assert.equal(requiresStudioSetup({ ...member, workspaceRole: 'owner' }), true);
  assert.equal(requiresStudioSetup({ ...member, isPreview: true }), false);
  for (const workspace of [undefined, { id: 'legacy' }, { id: 'ready', setupRequired: false }]) assert.equal(requiresStudioSetup({ workspace }), false);
});

test('completing setup returns to the requested studio page within the member’s grants', () => {
  assert.equal(afterStudioSetup(member, '/admin/contacts?tab=people#client'), '/admin/contacts?tab=people#client');
  assert.equal(afterStudioSetup({ ...member, moduleAccess: ['quotations'] }, '/quote-preview/abc'), '/quote-preview/abc');
  for (const path of ['/quote-preview/abc', '/admin/settings', '/admin/setup', '/admin/../auth', '/admin/contacts/../../auth', 'https://example.test', '//[', '/\\example.test', undefined]) {
    assert.equal(afterStudioSetup(member, path), '/admin');
  }
});

test('reloading reads the studio’s current setup state and membership from the verified session', async () => {
  const fetcher = async () => ({ ok: true, status: 200, json: async () => ({
    _id: 'member', role: 'admin', workspaceRole: 'staff', moduleAccess: ['contacts'],
    workspace: { id: 'studio', name: 'Renamed Studio', setupRequired: false, privateValue: 'ignored' },
  }) });
  const verified = await verifyStoredSession({ token: 'local-test', user: { ...member, workspaceRole: 'owner' } }, { fetcher });
  assert.deepEqual(verified.user.workspace, { id: 'studio', name: 'Renamed Studio', role: 'staff', setupRequired: false });
  assert.equal(verified.user.workspaceRole, 'staff');
  const mismatch = await verifyStoredSession({ token: 'local-test', user: { ...member, workspace: { id: 'other' } } }, { fetcher });
  assert.equal(mismatch.status, 'expired');
});

test('only a signed-in owner of an established commercial studio can reopen setup', () => {
  const ready = { ...member, workspaceRole: 'owner', workspace: { id: 'ready', setupRequired: false } };
  assert.equal(canReviewStudioSetup(ready), true);
  assert.equal(canReviewStudioSetup({ ...ready, workspace: { _id: 'legacy' } }), true);
  for (const user of [undefined, { ...ready, workspaceRole: 'admin' }, { ...ready, workspaceRole: 'staff' },
    { ...ready, isPreview: true }, { ...ready, workspace: { setupRequired: false } },
    { ...ready, workspace: { id: 'pending', setupRequired: true } }]) {
    assert.equal(canReviewStudioSetup(user), false);
  }
  assert.equal(requiresStudioSetup(ready), false);
});

test('a voluntary review submits only edited fields for the step, including intentional clears', () => {
  const saved = { studioName: 'North Studio', email: 'hello@example.test', invoiceDueDays: 30, logoUrl: null };
  const edited = { ...saved, studioName: 'South Studio', email: '', invoiceDueDays: '30', logoUrl: '' };
  assert.deepEqual(changedSetupFields(saved, saved), {});
  assert.deepEqual(changedSetupFields(edited, saved, ['studioName', 'logoUrl']), { studioName: 'South Studio' });
  assert.deepEqual(changedSetupFields(edited, saved), { studioName: 'South Studio', email: '' });
});
