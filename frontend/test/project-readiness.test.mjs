import test from 'node:test';
import assert from 'node:assert/strict';
import { projectNextStep, projectChecklistSummary, projectReadinessActions } from '../src/admin/components/projects/projectReadiness.js';

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

const booked = { ...detail, project: { ...detail.project, status: 'Booked' } };
const clock = { now: new Date('2026-11-22T12:00:00Z'), timezone: 'Asia/Kolkata' };
test('project guidance opens the exact invoice, including a late partially paid installment', () => {
  const invoice = { _id: 'inv/1', documentStatus: 'Sent', status: 'Pending', advancePaid: 25, total: 100,
    dueDate: '2027-01-01', paymentScheduleEnabled: true,
    paymentSchedule: [{ dueDate: '2026-11-01', amountPaise: 5000 }, { dueDate: '2027-01-01', amountPaise: 5000 }] };
  const data = { ...booked, invoices: [invoice, { _id: 'draft', documentStatus: 'Draft' }] };
  assert.equal(projectNextStep(data, owner, clock).href, '/admin/invoices/inv%2F1');
  assert.equal(projectNextStep({ ...data, invoices: [{ ...invoice, advancePaid: 50 }, data.invoices[1]] }, owner, clock).href, '/admin/invoices/draft');
  assert.equal(projectNextStep(data, member('production'), clock).tab, 'delivery');
  assert.equal(projectNextStep({ ...data, project: { ...data.project, status: 'Archived' } }, owner, clock).action, undefined);
});

test('inquiry projects reuse the client and quote instead of starting duplicate records', () => {
  const inquiry = { ...booked, project: { ...booked.project, status: 'Inquiry' } };
  assert.equal(new URL('https://test' + projectNextStep(inquiry, owner, clock).href).searchParams.get('contact'), 'contact 1');
  const withQuote = { ...inquiry, quotations: [{ _id: 'quote 1', status: 'Sent', validUntil: '2026-10-01' }] };
  const result = projectNextStep(withQuote, owner, clock);
  assert.equal(result.href, '/admin/quotations?quote=quote+1');
  assert.match(result.label, /expired/);
  assert.equal(projectNextStep(withQuote, member(), clock).action, undefined);
});

test('urgent delivery work opens the exact task and respects terminal project states', () => {
  const data = { ...booked, production: { ...booked.production, tasks: [
    { _id: 'done', title: 'Already delivered', dueDate: '2026-10-22', status: 'completed' },
    { _id: 'future', title: 'Edit album', dueDate: '2027-01-22', status: 'pending' },
    { _id: 'due 1', title: 'Send proofs', dueDate: '2026-11-22', status: 'pending' },
  ] } };
  const next = projectNextStep(data, owner, clock);
  assert.equal(next.href, '/admin/post-production?task=due+1');
  assert.match(next.label, /Due today · Send proofs/);
  assert.equal(projectNextStep(data, member('projects', 'crew'), clock).tab, 'crew');
  assert.equal(projectNextStep({ ...data, project: { ...data.project, status: 'Completed' } }, owner, clock).action, undefined);
});

test('commercial staff can schedule and work tasks, with no crew assignment or quote creation prompts', () => {
  const staff = { ...member('projects', 'calendar', 'crew', 'production', 'quotations'), workspaceRole: 'staff', workspace: { role: 'staff', subscriptionStatus: 'active' } };
  const unscheduled = { ...booked, project: { ...booked.project, status: 'Inquiry' } };
  assert.equal(projectNextStep(unscheduled, staff, clock).key, 'schedule');
  const scheduled = { ...unscheduled, sessions: [{ _id: 'event' }] };
  assert.equal(projectNextStep(scheduled, staff, clock).tab, 'delivery');
  assert.equal(projectNextStep({ ...scheduled, quotations: [{ _id: 'q', status: 'Draft' }] }, staff, clock).href, '/admin/quotations?quote=q');
});

test('expired plans retain record reads, without guiding the user into creation or task editing', () => {
  const expired = { ...owner, workspaceRole: 'owner', workspace: { role: 'owner', subscriptionStatus: 'trialing', trialEndsAt: '2026-11-20' } };
  assert.equal(projectNextStep(booked, expired, clock).action, undefined);
  const withTask = { ...booked, production: { ...booked.production, tasks: [{ _id: 't', title: 'Album selection', status: 'pending' }] } };
  assert.equal(projectNextStep(withTask, expired, clock).tab, 'delivery');
  assert.equal(projectNextStep(withTask, expired, clock).href, undefined);
  assert.equal(projectNextStep({ ...booked, invoices: [{ _id: 'i', documentStatus: 'Draft' }] }, expired, clock).href, '/admin/invoices/i');
});
