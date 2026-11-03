import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFullModuleAccess, hasModuleAccess, canAccessStudioPath, moduleForStudioPath, canEditTeamMember, STUDIO_MODULE_IDS } from '../src/utils/moduleAccess.js';
const member = (moduleAccess, id = 'member') => ({ _id: id, role: 'admin', moduleAccess });
test('legacy administrators and studio owners keep workspace access', () => {
  assert.equal(hasFullModuleAccess(member(null)), true);
  assert.equal(hasModuleAccess({ ...member([]), studioOwner: true }, 'finance'), true);
  assert.equal(hasModuleAccess(null, 'finance'), false);
});
test('assigned invoice access does not grant finance or quotations', () => {
  const user = member(['invoices']);
  assert.equal(canAccessStudioPath(user, '/admin/invoices/new?contact=123'), true);
  assert.equal(canAccessStudioPath(user, '/admin/invoices/123'), true);
  assert.equal(canAccessStudioPath(user, '/admin/finance?view=invoices'), false);
  assert.equal(canAccessStudioPath(user, '/quote-preview/123'), false);
});
test('unknown and nested direct routes fail closed while landing remains available', () => {
  const user = member([]);
  assert.equal(canAccessStudioPath(user, '/admin'), true);
  assert.equal(canAccessStudioPath(user, '/admin/contacts/123'), false);
  assert.equal(canAccessStudioPath(user, '/admin/unknown'), false);
  assert.equal(canAccessStudioPath(user, '/admin/finance-other'), false);
  assert.equal(moduleForStudioPath('/admin/studio-projects/123?tab=payments'), 'projects');
});
test('restricted all-modules accounts retain aggregate restriction', () => {
  assert.equal(hasFullModuleAccess(member(STUDIO_MODULE_IDS)), false);
  assert.equal(hasModuleAccess(member(STUDIO_MODULE_IDS), 'finance'), true);
});
test('team managers cannot edit themselves, the owner or members beyond own grant', () => {
  const manager = member(['team', 'projects'], 'manager');
  assert.equal(canEditTeamMember(manager, member(['projects'])), true);
  assert.equal(canEditTeamMember(manager, member(['finance'])), false);
  assert.equal(canEditTeamMember(manager, member(null)), false);
  assert.equal(canEditTeamMember(manager, member(['team'], 'manager')), false);
  assert.equal(canEditTeamMember(member(null, 'admin'), { ...member(null), studioOwner: true }), false);
});
