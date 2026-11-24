const test = require('node:test');
const assert = require('node:assert/strict');
const { runInWorkspace, currentWorkspace, workspaceDatabase } = require('../saas/tenantContext');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Invoice = require('../models/Invoice');
const workspaceId = '0123456789abcdef01234567';
const workspace = { _id: workspaceId, databaseName: workspaceDatabase(workspaceId) };

test('overview queries scheduled leads and draft invoices only for a scoped owner requesting Today', async t => {
  const route = require('../routes/dashboardRoutes').stack.find(layer => layer.route?.path === '/studio-overview').route.stack[0].handle;
  const queries = [];
  const find = (model, rows) => filter => {
    const query = { model, filter, workspace: currentWorkspace()?.databaseName };
    queries.push(query);
    return {
      sort(order) { query.order = order; return this; },
      limit(limit) { query.limit = limit; return this; },
      select(fields) { query.fields = fields; return this; },
      populate() { return this; },
      lean: async () => rows,
    };
  };
  t.mock.method(require('../services/enquiryPipeline'), 'reconcile', async () => assert.fail('Overview must not repair enquiry links'));
  t.mock.method(require('../models/StudioConfig'), 'findOne', () => ({ select: () => ({ lean: async () => ({ timezone: 'UTC' }) }) }));
  for (const model of [Lead, Event, Task]) t.mock.method(model, 'aggregate', async () => []);
  for (const model of [Event, Task, require('../models/Photographer'), require('../models/DriveGallery')]) t.mock.method(model, 'countDocuments', async () => 0);
  t.mock.method(Lead, 'find', find('lead', []));
  t.mock.method(Task, 'find', find('task', []));
  t.mock.method(Event, 'find', find('event', [{ _id: 'event', allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-24' }]));
  t.mock.method(Invoice, 'find', find('invoice', [{ _id: 'draft', clientName: 'Client' }]));
  const owner = { query: { nextActions: '1' }, workspaceRole: 'owner', user: { role: 'admin', studioOwner: true } };
  async function read(scope, request) {
    queries.length = 0;
    let body;
    await runInWorkspace(scope, () => route(request, { json(value) { body = value; } }));
    return body;
  }
  for (const [scope, request] of [
    [null, owner], [workspace, { ...owner, query: {} }], [workspace, { ...owner, workspaceRole: 'staff' }],
    [workspace, { ...owner, user: { role: 'admin', moduleAccess: ['overview'] } }],
  ]) {
    const body = await read(scope, request);
    assert.equal(Object.hasOwn(body, 'draftInvoices'), false);
    assert.equal(Object.hasOwn(body, 'scheduledFollowUps'), false);
    assert.equal(Object.hasOwn(body.upcomingEvents[0], 'allDay'), false);
    assert.equal(queries.some(query => query.model === 'invoice' || query.filter?.followUpDate), false);
  }
  const body = await read(workspace, owner);
  const leads = queries.find(query => query.filter?.followUpDate);
  const invoices = queries.find(query => query.model === 'invoice');
  assert.deepEqual(leads.filter.status.$in, ['New', 'Follow-up', 'Meeting', 'Negotiation']);
  assert.deepEqual(leads.order, { followUpDate: 1, _id: 1 });
  assert.equal(leads.limit, 6);
  assert.equal(leads.fields, 'name status followUpDate eventType');
  assert.equal(invoices.limit, 3);
  assert.deepEqual(invoices.filter, { documentStatus: 'Draft', status: { $nin: ['Paid', 'Cancelled'] } });
  assert.equal(invoices.fields, 'clientName documentNumber createdAt');
  assert.equal(invoices.workspace, workspace.databaseName);
  assert.equal(leads.workspace, workspace.databaseName);
  assert.deepEqual(body.draftInvoices, [{ _id: 'draft', clientName: 'Client' }]);
  assert.equal(body.upcomingEvents[0].allDay, true);
});
