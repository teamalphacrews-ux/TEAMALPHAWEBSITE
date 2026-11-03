import test from 'node:test';
import assert from 'node:assert/strict';
import { projectChecklistSummary, projectReadinessActions } from '../src/admin/components/projects/projectReadiness.js';

const detail = { project: { _id: 'project 1', contactId: { _id: 'contact 1' } }, sessions: [], production: { lead: { _id: 'lead' }, crew: [], tasks: [] } };
const owner = { studioOwner: true };
const member = (...moduleAccess) => ({ moduleAccess });

test('an empty project checklist is not represented as completed work', () => {
  assert.deepEqual(projectChecklistSummary([]), { value: 'Not started', label: 'Checklist' });
  assert.deepEqual(projectChecklistSummary([{ status: 'pending' }, { status: 'completed' }]), { value: '1 / 2', label: 'Tasks complete' });
  assert.deepEqual(projectChecklistSummary([{ status: 'completed' }]), { value: '1 / 1', label: 'Tasks complete' });
});

test('readiness actions point to the existing project schedule and production tabs', () => {
  const actions = projectReadinessActions(detail, owner);
  assert.deepEqual(actions.map(action => action.key), ['schedule', 'crew', 'checklist']);
  const calendar = new URL(actions[0].href, 'https://studio.example');
  assert.equal(calendar.pathname, '/admin/calendar');
  assert.equal(calendar.searchParams.get('project'), 'project 1');
  assert.equal(calendar.searchParams.get('contact'), 'contact 1');
  assert.equal(actions[1].tab, 'crew');
  assert.equal(actions[2].tab, 'delivery');
});

test('readiness only exposes actions assigned to the current account', () => {
  assert.deepEqual(projectReadinessActions(detail, member()), []);
  assert.deepEqual(projectReadinessActions(detail, member('calendar')).map(action => action.key), ['schedule']);
  assert.deepEqual(projectReadinessActions(detail, member('crew')).map(action => action.key), ['crew']);
  assert.deepEqual(projectReadinessActions(detail, member('production')).map(action => action.key), ['checklist']);
  assert.deepEqual(projectReadinessActions(detail, null), []);
});

test('populated workflows do not retain stale missing-readiness actions', () => {
  const populated = { ...detail, sessions: [{ _id: 'session' }], production: { lead: detail.production.lead, crew: [{ name: 'Anu' }], tasks: [{ status: 'pending' }] } };
  assert.deepEqual(projectReadinessActions(populated, owner), []);
  assert.equal(detail.production.tasks.length, 0);
});

test('missing production connection cannot offer crew or checklist writes', () => {
  const disconnected = { ...detail, production: { warning: 'Linked enquiry unavailable' } };
  assert.deepEqual(projectReadinessActions(disconnected, owner).map(action => action.key), ['schedule']);
});
