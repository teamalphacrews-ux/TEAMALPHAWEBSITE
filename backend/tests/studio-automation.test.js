const test = require('node:test');
const assert = require('node:assert/strict');
const { indiaClock, createAutomationRunner } = require('../services/studioAutomation');
const query = rows => ({ select: () => ({ limit: () => ({ lean: async () => rows }) }) });
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
