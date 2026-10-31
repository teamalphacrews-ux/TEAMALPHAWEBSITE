import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkspaceSession, planPrice, roleLabel, safeDate, statusLabel, trialDaysLeft, workspaceId } from './workspaceValues.js';

test('only a server-confirmed studio session can replace the current workspace', () => {
  const session = { token: 'signed-session', user: { role: 'admin', workspace: { id: 'studio-1' } } };
  assert.equal(isWorkspaceSession(session), true);
  assert.equal(isWorkspaceSession({ ...session, token: ' ' }), false);
  assert.equal(isWorkspaceSession({ ...session, user: { ...session.user, role: 'client' } }), false);
  assert.equal(isWorkspaceSession({ ...session, user: { role: 'admin' } }), false);
  assert.equal(isWorkspaceSession({ ...session, user: { role: 'admin', workspace: { id: {} } } }), false);
  assert.equal(workspaceId({ id: '../other-studio' }), '');
  assert.equal(workspaceId({ _id: '66a16bb7745177b324763bfa' }), '66a16bb7745177b324763bfa');
});
test('plan display does not fabricate a price when commercial pricing is unconfigured', () => {
  for (const monthlyAmount of [null, undefined, '1499', 0, -100, NaN, Infinity]) assert.equal(planPrice({ monthlyAmount, currency: 'INR' }), null);
  assert.match(planPrice({ monthlyAmount: 1499, currency: 'INR' }), /1,499/);
  assert.equal(planPrice({ monthlyAmount: 1499, currency: 'not-a-currency' }), null);
});
test('unknown state and role values never impersonate activated or owner access', () => {
  assert.equal(roleLabel('owner'), 'Owner');
  assert.equal(roleLabel('constructor'), 'Team member');
  assert.equal(roleLabel('superadmin'), 'Team member');
  assert.equal(statusLabel('active'), 'Active');
  assert.equal(statusLabel('__proto__'), 'Pending activation');
  assert.equal(statusLabel(undefined), 'Pending activation');
});
test('expired or missing trials cannot show positive trial days', () => {
  assert.equal(trialDaysLeft('2000-01-01T00:00:00.000Z'), 0);
  assert.equal(trialDaysLeft(undefined), null);
  assert.equal(trialDaysLeft('invalid'), null);
  const nearFuture = new Date(Date.now() + 10 * 60000).toISOString();
  assert.equal(trialDaysLeft(nearFuture), 1);
});
test('missing or invalid server dates have a readable fallback', () => {
  assert.equal(safeDate(null), 'Not set');
  assert.equal(safeDate('invalid'), 'Not set');
  assert.match(safeDate('2026-12-18T12:00:00Z'), /18.*Dec.*2026/);
});
