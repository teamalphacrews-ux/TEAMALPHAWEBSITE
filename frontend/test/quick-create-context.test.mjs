import test from 'node:test';
import assert from 'node:assert/strict';
import { quickCreateActions } from '../src/utils/quickCreateActions.js';
import { clientNextAction } from '../src/admin/components/contacts/clientNextAction.js';

const owner = { studioOwner: true };
const staff = (...modules) => ({ moduleAccess: modules });
const create = (user, fields) => Object.fromEntries(quickCreateActions(user, { commercial: true, ...fields }).map(([key, , path]) => [key, path]));

test('global Create opens all eight commercial actions, and respects module and project prerequisites', () => {
  assert.deepEqual(Object.keys(create(owner)), ['enquiry', 'client', 'project', 'quote', 'invoice', 'task', 'event', 'expense']);
  assert.deepEqual(create(staff('projects', 'production')), { task: '/admin/post-production?new=1' });
  assert.equal(create(staff('projects', 'contacts')).project, '/admin/studio-projects?new=1');
  assert.deepEqual(create(null), {});
  assert.deepEqual(quickCreateActions(owner, { commercial: false, contactId: 'c1', projectId: 'p1' }).map(([, label]) => label), ['Enquiry', 'Quotation', 'Invoice', 'Expense', 'Shoot']);
});

test('create carries contact or project context using the destination’s own query contract', () => {
  const project = create(owner, { projectId: 'p1' });
  assert.equal(project.task, '/admin/post-production?new=1&studioProject=p1');
  assert.equal(project.quote, '/admin/quotations?new=1&project=p1');
  assert.equal(project.invoice, '/admin/invoices/new?project=p1');
  assert.equal(project.event, '/admin/calendar?new=1&project=p1');
  const client = create(owner, { contactId: 'c1' });
  assert.equal(client.project, '/admin/studio-projects?new=1&contact=c1');
  assert.equal(client.quote, '/admin/quotations?contact=c1');
  assert.equal(client.invoice, '/admin/invoices/new?contact=c1');
  assert.equal(client.event, '/admin/calendar?new=1&contact=c1');
  assert.equal(create(staff('invoices'), { contactId: 'private', projectId: 'private' }).invoice, '/admin/invoices/new');
});

const contact = { _id: 'c1', contactType: 'Client' };
const project = { _id: 'project', status: 'Booked', name: 'Wedding' };
const invoice = { _id: 'invoice', contactId: 'c1', documentStatus: 'Draft' };
const quote = { _id: 'quote', contactId: { _id: 'c1' }, status: 'Draft' };
test('client navigation points to an accessible exact draft, then the active project', () => {
  const detail = { contact, invoices: [invoice], quotations: [quote], projects: [project] };
  assert.equal(clientNextAction(owner, detail).to, '/admin/invoices/invoice');
  assert.equal(clientNextAction(staff('quotations'), detail).to, '/admin/quotations?quote=quote');
  assert.equal(clientNextAction(staff('projects'), detail).to, '/admin/studio-projects/project');
  assert.equal(clientNextAction(staff('contacts'), detail), null);
  assert.equal(clientNextAction(owner, { ...detail, contact: { ...contact, archived: true } }), null);
  assert.equal(clientNextAction(owner, { ...detail, invoices: [{ ...invoice, contactId: null }], quotations: [{ ...quote, validUntil: '2001-01-01' }] }, new Date('2026-01-01')).to, '/admin/studio-projects/project');
});
test('client guidance never chooses arbitrarily between bookings or proposes another booking after delivery', () => {
  assert.equal(clientNextAction(owner, { contact }).label, 'Create project');
  assert.equal(clientNextAction(owner, { contact, projects: [project, { ...project, _id: 'p2' }] }).to, undefined);
  assert.equal(clientNextAction(owner, { contact, projects: [{ ...project, status: 'Completed' }] }), null);
});

test('SaaS staff create calendar events and tasks, but cannot create financial, client or project records', () => {
  const member = { workspace: { role: 'staff', subscriptionStatus: 'active' }, moduleAccess: null };
  assert.deepEqual(Object.keys(create(member)), ['task', 'event']);
  assert.deepEqual(Object.keys(create({ ...member, moduleAccess: ['invoices', 'production'] })), ['task']);
  assert.equal(clientNextAction(member, { contact, invoices: [invoice], quotations: [quote], projects: [project] }).label, 'Open project');
  assert.equal(clientNextAction(member, { contact }), null);
});

test('effective subscription and workspace role gate writes but allow viewing an existing project', () => {
  const membership = (role, data) => ({ moduleAccess: null, workspaceRole: role, workspace: { state: 'active', ...data } });
  for (const user of [
    membership('owner', { subscriptionStatus: 'past_due' }),
    membership('admin', { subscriptionStatus: 'trialing', trialEndsAt: '2000-01-01' }),
    membership('staff', { subscriptionStatus: 'trialing' }),
    membership('owner', { state: 'suspended', subscriptionStatus: 'active' }),
    membership('removed', { subscriptionStatus: 'active' }),
  ]) {
    assert.deepEqual(create(user), {});
    assert.equal(clientNextAction(user, { contact }), null);
    assert.equal(clientNextAction(user, { contact, projects: [project] }).label, 'Open project');
  }
  assert.equal(Object.keys(create(membership('admin', { subscriptionStatus: 'active' }))).length, 8);
  assert.equal(Object.keys(create({ isPreview: true, ...membership('owner', { subscriptionStatus: 'trialing', trialEndsAt: '2099-01-01' }) })).length, 8);
});
