import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsWithDefaults, changedSettingsSections, restoreSettingsSection } from '../src/utils/settingsEditorState.js';

test('section revert preserves other drafts and does not mutate saved nested settings', () => {
  const saved = settingsWithDefaults({ studioName: 'Team Alpha' });
  const draft = structuredClone(saved);
  draft.studioName = 'Edited studio';
  draft.billingDefaults.paymentMilestones[0].percent = 40;
  assert.deepEqual(changedSettingsSections(draft, saved), ['profile', 'billing']);
  const reverted = restoreSettingsSection(draft, saved, 'billing');
  assert.equal(reverted.studioName, 'Edited studio');
  assert.equal(reverted.billingDefaults.paymentMilestones[0].percent, 30);
  reverted.billingDefaults.paymentMilestones[0].percent = 60;
  assert.equal(saved.billingDefaults.paymentMilestones[0].percent, 30);
});
test('revert removes fields absent from the saved profile and tracks protected changes', () => {
  const saved = settingsWithDefaults({ studioName: 'Team Alpha' });
  const draft = { ...saved, gstin: 'draft', security: { ...saved.security, idleTimeoutMinutes: 10 } };
  const reverted = restoreSettingsSection(draft, saved, 'profile');
  assert.equal(Object.hasOwn(reverted, 'gstin'), false);
  assert.deepEqual(changedSettingsSections(reverted, saved), ['security']);
});
test('older saved profiles receive isolated defaults without losing saved owner permissions', () => {
  const one = settingsWithDefaults({ security: { permissions: { deletion: 'owner_only' } } });
  const two = settingsWithDefaults();
  assert.equal(one.security.permissions.deletion, 'owner_only');
  assert.equal(one.security.permissions.exports, 'all_admins');
  one.billingDefaults.paymentMilestones[0].percent = 90;
  assert.equal(two.billingDefaults.paymentMilestones[0].percent, 30);
});
