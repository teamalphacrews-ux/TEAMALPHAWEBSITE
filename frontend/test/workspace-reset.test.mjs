import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirmReset, RESET_CONFIRMATION, resetReadiness } from '../src/utils/workspaceReset.js';

const summary = { keyConfigured: true, recoveryEnabled: true, resetBlocked: false, maintenanceBlocked: false, blockers: [] };
const confirmation = { summary, preview: false, backupId: 'fresh-backup', savedCopy: true, acknowledged: true, phrase: RESET_CONFIRMATION, password: 'test-only-password', busy: false };

test('reset readiness fails closed for loading, preview, incomplete and blocked server responses', () => {
  for (const value of [null, {}, { ...summary, keyConfigured: false }, { ...summary, recoveryEnabled: false }, { ...summary, resetBlocked: true }, { ...summary, resetBlocked: undefined }, { ...summary, maintenanceBlocked: true }, { ...summary, blockers: ['Local media is not archived'] }]) {
    assert.equal(resetReadiness(value).ready, false);
  }
  assert.equal(resetReadiness(summary, { preview: true }).ready, false);
  assert.equal(resetReadiness(summary).ready, true);
});

test('a stale maintenance lock explains operator action instead of suggesting owner credentials unlock it', () => {
  const state = resetReadiness({ ...summary, maintenanceBlocked: true, recoveryEnabled: false });
  assert.equal(state.title, 'Server maintenance needs attention');
  assert.match(state.message, /Owner access cannot clear this lock/);
});

test('backup, saved-copy acknowledgement, deletion acknowledgement, exact phrase and owner password are all required', () => {
  assert.equal(canConfirmReset(confirmation), true);
  for (const change of [{ backupId: null }, { savedCopy: false }, { acknowledged: false }, { phrase: 'delete workspace data' }, { phrase: RESET_CONFIRMATION + ' ' }, { password: '' }, { password: '   ' }, { busy: true }, { preview: true }, { summary: null }]) {
    assert.equal(canConfirmReset({ ...confirmation, ...change }), false, JSON.stringify(change));
  }
});

test('readiness revocation blocks final confirmation even after a backup has been saved', () => {
  assert.equal(canConfirmReset({ ...confirmation, summary: { ...summary, resetBlocked: true } }), false);
  assert.equal(canConfirmReset({ ...confirmation, summary: { ...summary, recoveryEnabled: false } }), false);
});
