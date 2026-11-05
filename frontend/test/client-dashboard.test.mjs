import test from 'node:test';
import assert from 'node:assert/strict';
import { clientDashboardSummary, clientPaymentRows } from '../src/utils/clientDashboardData.js';

const now = new Date('2026-10-24T20:00:00Z'); // 25 October in the studio.
const quote = { status: 'Accepted', totalPaise: 25000000, documentNumber: 'TA-Q-42', acceptedAt: '2026-10-22T10:00:00Z' };
const issued = document => ({ visibility: {}, invoice: { state: 'issued', document: { documentStatus: 'Sent', documentNumber: 'TA-INV-42', status: 'Pending', total: 1000, advancePaid: 150, currency: 'INR', ...document } }, production: { state: 'not_started', deliveries: [] } });

test('quotation summary uses the public paise amount and accepted state', () => {
  const result = clientDashboardSummary({ quote, project: null, now });
  assert.deepEqual(result.quotation, { visible: true, status: 'Accepted', number: 'TA-Q-42', total: 250000, currency: 'INR', acceptedAt: '2026-10-22T10:00:00Z' });
  assert.equal(result.invoice.visible, false);
  assert.equal(result.invoice.total, null);
  assert.equal(result.production.completionPercent, null);
});

test('unavailable or malformed quotation amounts never become guessed zeroes', () => {
  assert.equal(clientDashboardSummary({ quote: { ...quote, totalPaise: undefined } }).quotation.total, null);
  assert.equal(clientDashboardSummary({ quote: { ...quote, totalPaise: -100 } }).quotation.total, null);
  const draft = clientDashboardSummary({ quote: { status: 'Draft', totalPaise: 999999, documentNumber: 'PRIVATE' } });
  assert.equal(draft.quotation.visible, false);
  assert.equal(draft.quotation.total, null);
  assert.equal(draft.quotation.number, '');
  const expired = clientDashboardSummary({ quote: { status: 'Sent', totalPaise: 0, expiresAt: '2026-10-24T10:00:00Z' }, now });
  assert.equal(expired.quotation.status, 'Expired');
  assert.equal(expired.quotation.total, 0);
});

test('draft, preparing and cancelled invoice views cannot leak document amounts or payment schedules', () => {
  for (const state of ['preparing', 'awaiting_approval', 'cancelled']) {
    const project = issued({ dueDate: '2026-10-20' });
    project.invoice.state = state;
    project.invoice.quotedTotal = 999999;
    const result = clientDashboardSummary({ quote, project, now });
    assert.equal(result.invoice.total, null);
    assert.equal(result.invoice.paid, null);
    assert.equal(result.invoice.balance, null);
    assert.equal(result.payments.next, null);
    assert.equal(result.payments.available, false);
  }
  assert.equal(clientDashboardSummary({ project: issued({ documentStatus: 'Draft' }), now }).invoice.total, null);
  assert.equal(clientDashboardSummary({ project: issued({ status: 'Cancelled' }), now }).invoice.total, null);
});

test('issued balances and next payment use earliest scheduled credit allocation without mutating the payload', () => {
  const project = issued({ paymentScheduleEnabled: true, paymentSchedule: [
    { label: 'Final delivery', dueDate: '2026-11-01', amountPaise: 50000 },
    { label: 'Event', dueDate: '2026-10-25', amountPaise: 30000 },
    { label: 'Booking', dueDate: '2026-10-20', amountPaise: 20000 },
  ] });
  const original = structuredClone(project);
  const result = clientDashboardSummary({ quote, project, now });
  assert.equal(result.invoice.total, 1000);
  assert.equal(result.invoice.paid, 150);
  assert.equal(result.invoice.balance, 850);
  assert.equal(result.payments.balance, 850);
  assert.equal(result.payments.dueNow, 350);
  assert.deepEqual(result.payments.next, { label: 'Booking', dueDate: '2026-10-20', amount: 50, state: 'Overdue' });
  assert.deepEqual(project, original);
});

test('paid and zero-value invoices clear outstanding payments without counting deposits twice', () => {
  const paid = clientDashboardSummary({ project: issued({ status: 'Paid', advancePaid: 5, dueDate: '2026-10-25' }), now });
  assert.equal(paid.invoice.paid, 1000);
  assert.equal(paid.payments.balance, 0);
  assert.equal(paid.payments.dueNow, 0);
  assert.equal(paid.payments.next, null);
  const zero = clientDashboardSummary({ project: issued({ total: 0, advancePaid: undefined }), now });
  assert.equal(zero.payments.balance, 0);
});

test('missing payment facts and malformed schedules remain unknown instead of inventing a payment plan', () => {
  const missingCredit = clientDashboardSummary({ project: issued({ advancePaid: undefined }), now });
  assert.equal(missingCredit.invoice.balance, null);
  assert.equal(missingCredit.payments.available, false);
  for (const schedule of [[], [null], [{ amountPaise: 999, dueDate: '2026-10-25' }], [{ amountPaise: 100000, dueDate: '2026-99-99' }], [{ amountPaise: -100000, dueDate: '2026-10-25' }]]) {
    const result = clientDashboardSummary({ project: issued({ paymentScheduleEnabled: true, paymentSchedule: schedule }), now });
    assert.equal(result.payments.balance, 850);
    assert.equal(result.payments.scheduleKnown, false);
    assert.equal(result.payments.next, null);
    assert.equal(result.payments.dueNow, null);
  }
});

test('unscheduled balances identify today in India and leave absent deadlines unconfirmed', () => {
  const today = clientDashboardSummary({ project: issued({ dueDate: '2026-10-25' }), now });
  assert.equal(today.payments.next.state, 'Due today');
  assert.equal(today.payments.next.amount, 850);
  assert.equal(today.payments.dueNow, 850);
  const undated = clientDashboardSummary({ project: issued({ dueDate: undefined }), now });
  assert.equal(undated.payments.next.state, 'Awaiting date');
  assert.equal(undated.payments.next.dueDate, null);
  assert.equal(undated.payments.dueNow, null);
});

test('payment visibility removes all financial summaries even if a stale payload contains a document', () => {
  const project = issued({ dueDate: '2026-10-20' });
  project.visibility.showPayments = false;
  const result = clientDashboardSummary({ quote, project, now });
  assert.equal(result.invoice.visible, false);
  assert.equal(result.invoice.state, 'hidden');
  assert.equal(result.invoice.number, '');
  assert.equal(result.invoice.total, null);
  assert.equal(result.payments.balance, null);
  assert.equal(result.payments.next, null);
});

test('production completion distinguishes ready files from finished deliveries and respects published URL visibility', () => {
  const project = issued({});
  project.production = { state: 'in_progress', deliveries: [
    { stage: 'Delivered', url: 'https://drive.google.com/folder/1' },
    { stage: 'Ready', url: 'https://drive.google.com/folder/2' },
    { stage: 'Editing', url: '' },
  ] };
  const result = clientDashboardSummary({ project });
  assert.equal(result.production.total, 3);
  assert.equal(result.production.completed, 1);
  assert.equal(result.production.ready, 2);
  assert.equal(result.production.completionPercent, 33);
  assert.equal(result.production.published, 2);
  project.visibility.showDeliverables = false;
  assert.equal(clientDashboardSummary({ project }).production.published, null);
});

test('hidden progress never derives percentages or stage from files-only payloads', () => {
  const project = issued({});
  project.visibility.showProgress = false;
  project.production = { state: 'in_progress', deliveries: [
    { stage: 'Delivered', url: 'https://drive.google.com/folder/1' },
    { url: 'https://user:password@example.com/private' },
    { url: 'javascript:alert(1)' },
  ] };
  const result = clientDashboardSummary({ project });
  assert.equal(result.production.state, 'deliveries_only');
  assert.equal(result.production.total, null);
  assert.equal(result.production.completed, null);
  assert.equal(result.production.completionPercent, null);
  assert.equal(result.production.published, 1);
  project.visibility.showDeliverables = false;
  assert.equal(clientDashboardSummary({ project }).production.visible, false);
});

test('empty, unknown or incomplete production data cannot claim full completion', () => {
  for (const deliveries of [undefined, [], [null], [{ stage: 'Delivered' }, {}]]) {
    const project = issued({});
    project.production = { state: 'delivered', deliveries };
    assert.equal(clientDashboardSummary({ project }).production.completionPercent, null);
  }
  const project = issued({});
  project.production = { state: 'delivered', deliveries: [{ stage: 'Delivered' }, { stage: 'Uploaded to Drive' }] };
  assert.equal(clientDashboardSummary({ project }).production.completionPercent, 100);
});

test('payment accordion rows and summary agree for unsorted schedules, including fully paid installments', () => {
  const project = issued({ advancePaid: 250, paymentScheduleEnabled: true, paymentSchedule: [
    { label: 'Delivery', dueDate: '2026-11-01', amountPaise: 50000 },
    { label: 'Event', dueDate: '2026-10-25', amountPaise: 30000 },
    { label: 'Booking', dueDate: '2026-10-20', amountPaise: 20000 },
  ] });
  const rows = clientPaymentRows(project.invoice.document, now);
  const summary = clientDashboardSummary({ project, now });
  assert.deepEqual(rows.map(row => [row.number, row.label, row.remaining, row.state]), [[1, 'Booking', 0, 'Paid'], [2, 'Event', 25000, 'Due today'], [3, 'Delivery', 50000, 'Upcoming']]);
  assert.equal(rows.reduce((sum, row) => sum + row.remaining, 0) / 100, summary.payments.balance);
  const next = rows.find(row => row.remaining > 0);
  assert.deepEqual(summary.payments.next, { label: next.label, dueDate: next.dueDate, amount: next.remaining / 100, state: next.state });
  assert.equal(rows.filter(row => ['Overdue', 'Due today'].includes(row.state)).reduce((sum, row) => sum + row.remaining, 0) / 100, summary.payments.dueNow);
  assert.deepEqual(clientPaymentRows({ ...project.invoice.document, status: 'Paid' }, now).map(row => row.state), ['Paid', 'Paid', 'Paid']);
});

test('payment accordion rejects draft, malformed and financially unknown documents', () => {
  assert.deepEqual(clientPaymentRows(undefined, now), []);
  assert.deepEqual(clientPaymentRows(issued({ documentStatus: 'Draft' }).invoice.document, now), []);
  assert.deepEqual(clientPaymentRows(issued({ advancePaid: undefined }).invoice.document, now), []);
  assert.deepEqual(clientPaymentRows(issued({ paymentScheduleEnabled: true, paymentSchedule: [{ amountPaise: 100, dueDate: '2026-10-25' }] }).invoice.document, now), []);
});
