const test = require('node:test');
const assert = require('node:assert/strict');
const Invoice = require('../models/Invoice');
const Quotation = require('../models/Quotation');
const QuoteDelivery = require('../models/QuoteDelivery');
const mailer = require('../services/studioMailer');
const { runInvoiceDeliveryJobs } = require('../services/invoiceDelivery');
const { runQuoteDeliveryJobs } = require('../services/quoteWorkflow');
const { currentWorkspace, runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');

const now = new Date('2026-11-28T12:00:00.000Z');
const shareDate = new Date('2026-11-21T12:00:00.000Z');
const studio = _id => ({ _id, databaseName: workspaceDatabase(_id) });

function query(rows, expectedSort, filter = {}) {
  return {
    select() { return this; },
    sort(value) { assert.deepEqual(value, expectedSort); return this; },
    async limit(count) { return rows.filter(row => !filter._id || row._id > filter._id.$gt).slice(0, count); },
  };
}

function enableFixtureMail(t) {
  const previous = [process.env.EMAIL_USER, process.env.EMAIL_PASS];
  process.env.EMAIL_USER = 'sender@example.test';
  process.env.EMAIL_PASS = 'fixture';
  t.after(() => {
    for (const [index, key] of ['EMAIL_USER', 'EMAIL_PASS'].entries()) {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }
  });
}

test('the quotation worker reaches reminders after the old limit and keeps the delivery queue oldest-first', async t => {
  t.mock.timers.enable({ apis: ['Date'], now });
  t.mock.method(mailer, 'mailerReady', () => true);
  const dormant = { expiryEnabled: false, sharedAt: shareDate, remindersEnabled: false };
  const active = { ...dormant, _id: 'eligible', revision: 2, remindersEnabled: true, reminderDays: [7] };
  const rows = Array.from({ length: 251 }, (_, index) => ({ ...dormant, _id: String(index).padStart(3, '0') })).concat(active);
  t.mock.method(Quotation, 'find', filter => query(rows, { _id: 1 }, filter));
  t.mock.method(QuoteDelivery, 'updateMany', async () => ({}));
  const scheduled = [];
  t.mock.method(QuoteDelivery, 'updateOne', async ({ key }) => { scheduled.push(key); });
  t.mock.method(QuoteDelivery, 'find', filter => {
    assert.equal(filter.status, 'queued');
    return query([], { dueAt: 1, _id: 1 });
  });
  await runQuoteDeliveryJobs();
  assert.deepEqual(scheduled, ['reminder:eligible:2:7']);
});

test('quotation delivery suppresses overlapping runs only within the same studio', async t => {
  const one = studio('a'.repeat(24));
  const two = studio('b'.repeat(24));
  const entered = Promise.withResolvers();
  const resume = Promise.withResolvers();
  const scans = [];
  t.mock.method(mailer, 'mailerReady', () => false);
  t.mock.method(QuoteDelivery, 'updateMany', async () => ({}));
  t.mock.method(Quotation, 'find', () => ({
    sort() { return this; },
    async limit() {
      const { databaseName } = currentWorkspace();
      scans.push(databaseName);
      if (databaseName === one.databaseName) {
        entered.resolve();
        await resume.promise;
      }
      return [{ expiryEnabled: false }];
    },
  }));
  const first = runInWorkspace(one, runQuoteDeliveryJobs);
  await entered.promise;
  try {
    await runInWorkspace(one, runQuoteDeliveryJobs);
    await runInWorkspace(two, runQuoteDeliveryJobs);
    assert.deepEqual(scans, [one.databaseName, two.databaseName]);
  } finally {
    resume.resolve();
    await first;
  }
});

test('invoice reminder scan reaches due invoices past the old limit', async t => {
  enableFixtureMail(t);
  t.mock.timers.enable({ apis: ['Date'], now });
  const dormant = { total: 1, dueDate: '2026-12-21', reminderOffsets: [0] };
  const due = { ...dormant, _id: 'due', dueDate: '2026-11-28' };
  t.mock.method(Invoice, 'updateMany', async () => ({}));
  const rows = Array.from({ length: 201 }, (_, index) => ({ ...dormant, _id: String(index).padStart(3, '0') })).concat(due);
  t.mock.method(Invoice, 'find', filter => filter.paymentReminders
    ? query(rows, { _id: 1 }, filter)
    : query([], { 'scheduledDelivery.at': 1, _id: 1 }));
  const claims = [];
  // A concurrent reminder already owns the claim. SMTP must stay unused.
  t.mock.method(Invoice, 'updateOne', async ({ _id }) => {
    claims.push(_id);
    return { modifiedCount: 0 };
  });
  await runInvoiceDeliveryJobs();
  assert.deepEqual(claims, ['due']);
});

test('bounded invoice reminder deliveries pick up the next due invoices on the following tick', async t => {
  enableFixtureMail(t);
  t.mock.timers.enable({ apis: ['Date'], now });
  const rows = Array.from({ length: 202 }, (_, index) => ({
    _id: String(index).padStart(3, '0'), total: 1, dueDate: '2026-11-28', reminderOffsets: [0],
  }));
  t.mock.method(Invoice, 'updateMany', async () => ({}));
  t.mock.method(Invoice, 'find', filter => filter.paymentReminders
    ? query(rows, { _id: 1 }, filter)
    : query([], { 'scheduledDelivery.at': 1, _id: 1 }));
  const claimed = new Set();
  t.mock.method(Invoice, 'updateOne', async ({ _id, reminderLog }) => {
    // The fixtures have no client addresses, so the normal send check declines
    // before opening an SMTP connection but still consumes the claimed slot.
    if (!reminderLog || claimed.has(_id)) return { modifiedCount: 0 };
    claimed.add(_id);
    return { modifiedCount: 1 };
  });
  await runInvoiceDeliveryJobs();
  assert.equal(claimed.size, 200);
  await runInvoiceDeliveryJobs();
  assert.deepEqual([...claimed], rows.map(({ _id }) => _id));
});

test('scheduled invoices refuse stale claims and older workers cannot overwrite an updated schedule', async t => {
  enableFixtureMail(t);
  t.mock.timers.enable({ apis: ['Date'], now });
  const stale = { _id: 'stale', updatedAt: shareDate, scheduledDelivery: { at: shareDate } };
  // Old unapproved documents are marked failed under the existing delivery policy.
  const oldDraft = { ...stale, _id: 'unapproved', documentStatus: 'Draft' };
  t.mock.method(Invoice, 'updateMany', async () => ({}));
  t.mock.method(Invoice, 'find', filter => filter.paymentReminders
    ? query([], { _id: 1 })
    : query([stale, oldDraft], { 'scheduledDelivery.at': 1, _id: 1 }));
  const changes = [];
  t.mock.method(Invoice, 'updateOne', async (filter, update) => {
    changes.push({ filter, state: update.$set['scheduledDelivery.state'] });
    return { modifiedCount: filter._id === stale._id ? 0 : 1 };
  });
  await runInvoiceDeliveryJobs();
  assert.deepEqual(changes.map(({ state }) => state), ['sending', 'sending', 'failed']);
  assert.equal(changes[0].filter.updatedAt, stale.updatedAt);
  assert.equal(changes[0].filter['scheduledDelivery.at'], stale.scheduledDelivery.at);
  assert.deepEqual(changes[2].filter, {
    _id: oldDraft._id,
    'scheduledDelivery.at': oldDraft.scheduledDelivery.at,
    'scheduledDelivery.claimAt': now,
    'scheduledDelivery.state': 'sending',
  });
});
