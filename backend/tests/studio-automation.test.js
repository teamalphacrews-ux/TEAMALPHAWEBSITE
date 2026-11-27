const test = require('node:test');
const assert = require('node:assert/strict');
const { indiaClock, createAutomationRunner } = require('../services/studioAutomation');
function query(rows) {
  const selection = {
    limit: size => ({ lean: async () => rows.slice(0, size) }),
    lean: () => ({ cursor: () => rows }),
  };
  return { select: () => selection };
}
test('automation days follow India midnight rather than UTC', () => {
  const clock = indiaClock(new Date('2026-10-23T18:31:00Z'));
  assert.equal(clock.day, '2026-10-24'); assert.equal(clock.hour, 0); assert.equal(clock.start.toISOString(), '2026-10-23T18:30:00.000Z');
});
test('notification toggles prevent queries and daily briefing is deduplicated across repeated runs', async () => {
  const saved = new Map(); let queries = 0;
  const quiet = { notifyQuoteAccepted: false, notifyPaymentOverdue: false, notifyAssignments: false, notifyDeliveryDue: false, dailyDigestEnabled: true, dailyDigestHour: 9 };
  const Notification = { findOneAndUpdate: async (filter, update) => { if (!saved.has(filter.eventKey)) saved.set(filter.eventKey, update.$setOnInsert); } };
  const unused = { find: () => { queries++; return query([]); } };
  const count = value => ({ ...unused, countDocuments: async () => value });
  const run = createAutomationRunner({ Config: { findOne: async () => ({ automation: quiet }) }, Notification, Quotation: unused, Invoice: unused, Task: count(5), Event: count(2), Lead: count(3), now: () => new Date('2026-10-23T04:30:00Z') });
  await run(); await run(); assert.equal(queries, 0); assert.equal(saved.size, 1); assert.match([...saved.values()][0].description, /3 open enquiries · 2 events.*5 pending/);
});
test('payment alerts include only outstanding issued invoices and use one event key per Indian day', async () => {
  const keys = new Set(); let filter;
  const automation = { notifyQuoteAccepted: false, notifyPaymentOverdue: true, notifyAssignments: false, notifyDeliveryDue: false, dailyDigestEnabled: false };
  const run = createAutomationRunner({ Config: { findOne: async () => ({ automation }) }, Notification: { findOneAndUpdate: async query => keys.add(query.eventKey) }, Invoice: { find: queryFilter => { filter = queryFilter; return query([{ _id: 'unpaid', clientName: 'A', total: 1000, advancePaid: 200 }, { _id: 'settled', total: 1000, advancePaid: 1000 }]); } }, now: () => new Date('2026-10-23T05:00:00Z') });
  await run(); await run(); assert.equal(filter.documentStatus, 'Sent'); assert.equal(filter.status, 'Pending'); assert.equal(filter.dueDate.$lt.toISOString(), '2026-10-22T18:30:00.000Z'); assert.deepEqual([...keys], ['payment-overdue:unpaid:2026-10-23']);
});

test('a workspace acceptance alert links to its generated invoice, with a quote fallback during recovery', async () => {
  const { runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');
  const id = '123456789012345678901234';
  const notes = [];
  const rows = [
    { _id: 'q1', invoiceId: 'i1', invoiceGeneratedAt: new Date() },
    { _id: 'q2', invoiceId: 'reserved-but-unwritten' },
    { _id: 'q3' },
  ];
  const automation = { notifyQuoteAccepted: true, notifyPaymentOverdue: false, notifyAssignments: false, notifyDeliveryDue: false, dailyDigestEnabled: false };
  const run = createAutomationRunner({
    Config: { findOne: async () => ({ automation }) },
    Notification: { findOneAndUpdate: async (_filter, update) => { notes.push(update.$setOnInsert.link); } },
    Quotation: { find: () => query(rows) },
  });
  await runInWorkspace({ _id: id, databaseName: workspaceDatabase(id) }, run);
  assert.deepEqual(notes, ['/admin/invoices/i1', '/admin/quotations?quote=q2', '/admin/quotations?quote=q3']);
  notes.length = 0;
  await runInWorkspace(null, run);
  assert.deepEqual(notes, rows.map(row => '/admin/quotations?quote=' + row._id));
});

test('a retried reminder scan reaches pending tasks past the first 100 without duplicating reminders', async () => {
  const tasks = Array.from({ length: 205 }, (_, index) => ({ _id: index + 1, title: 'Sample task' }));
  const saved = new Set();
  let interrupt = true;
  const run = createAutomationRunner({
    Config: { findOne: async () => ({ automation: {
      notifyQuoteAccepted: false, notifyAssignments: false, notifyPaymentOverdue: false,
      dailyDigestEnabled: false, notifyDeliveryDue: true,
    } }) },
    Task: { find: () => query(tasks) },
    Notification: { findOneAndUpdate: async ({ eventKey }) => {
      if (interrupt && saved.size === 25) { interrupt = false; throw new Error('Temporary database failure'); }
      saved.add(eventKey);
    } },
    now: () => new Date('2028-02-28T19:00:00Z'),
  });
  await assert.rejects(run(), /Temporary database failure/);
  await run();
  await run();
  assert.equal(saved.size, 205);
  assert.ok(saved.has('delivery-due:205:2028-02-29'));
});

test('concurrent automation runs isolate studios and coalesce repeated ticks for the same studio', async t => {
  const { currentWorkspace, runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');
  const { runStudioAutomation } = require('../services/studioAutomation');
  const config = require('../models/StudioConfig');
  const studios = ['a'.repeat(24), 'b'.repeat(24)].map(id => ({ _id: id, databaseName: workspaceDatabase(id) }));
  const started = [];
  const held = Promise.withResolvers();
  t.mock.method(config, 'findOne', async () => {
    const id = currentWorkspace()._id;
    started.push(id);
    if (id === studios[0]._id) await held.promise;
    return { automation: {
      notifyQuoteAccepted: false, notifyPaymentOverdue: false, notifyDeliveryDue: false,
      notifyAssignments: false, dailyDigestEnabled: false,
    } };
  });
  const first = runInWorkspace(studios[0], runStudioAutomation);
  try {
    await runInWorkspace(studios[0], runStudioAutomation);
    await runInWorkspace(studios[1], runStudioAutomation);
    assert.deepEqual(started, studios.map(studio => studio._id));
  } finally {
    held.resolve();
    await first;
  }
});
