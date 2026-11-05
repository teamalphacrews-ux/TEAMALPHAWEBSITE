import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDueQueue } from '../src/admin/components/finance/duePayments.js';
import { overviewFinanceTotals } from '../src/admin/components/finance/overviewFinanceData.js';

const now = new Date('2026-10-24T20:00:00Z'); // 25 October in the studio timezone.
const invoice = (id, values = {}) => ({ _id: id, clientName: id, documentStatus: 'Sent', status: 'Pending', total: 1000, ...values });

test('Due now includes today and overdue balances, ordered earliest deadline first', () => {
  const rows = invoiceDueQueue([
    invoice('today', { dueDate: '2026-10-25', advancePaid: 100 }),
    invoice('late', { dueDate: '2026-10-22', advancePaid: 150.25 }),
    invoice('future', { dueDate: '2026-10-26' }),
    invoice('undated'),
  ], now);
  assert.deepEqual(rows.map(row => row.invoice._id), ['late', 'today']);
  assert.equal(rows[0].daysOverdue, 3);
  assert.equal(rows[0].amountDue, 849.75);
  assert.equal(rows[1].daysOverdue, 0);
  assert.equal(rows[1].amountDue, 900);
});

test('scheduled advances pay earliest installments first, and future amounts stay out of the due queue', () => {
  const source = invoice('schedule', { advancePaid: 150, paymentScheduleEnabled: true, paymentSchedule: [
    { label: 'Delivery', amountPaise: 50000, dueDate: '2026-10-30' },
    { label: 'Event', amountPaise: 30000, dueDate: '2026-10-25' },
    { label: 'Booking', amountPaise: 20000, dueDate: '2026-10-20' },
  ] });
  const rows = invoiceDueQueue([source], now);
  assert.equal(rows[0].amountDue, 350);
  assert.equal(rows[0].outstanding, 850);
  assert.equal(rows[0].daysOverdue, 5);
  assert.deepEqual(rows[0].installments.map(item => item.label), ['Booking', 'Event']);
  assert.equal(source.paymentSchedule[0].label, 'Delivery');
  assert.equal(overviewFinanceTotals([], [source], now).due, rows.reduce((sum, row) => sum + row.amountDue, 0));
});

test('unissued, cancelled, settled and foreign-currency invoices never enter the INR due queue', () => {
  const rows = invoiceDueQueue([
    invoice('draft', { documentStatus: 'Draft', dueDate: '2026-01-01' }),
    invoice('cancelled', { documentStatus: 'Cancelled', dueDate: '2026-01-01' }),
    invoice('archived', { documentStatus: 'Archived', dueDate: '2026-01-01' }),
    invoice('paid', { status: 'Paid', dueDate: '2026-01-01' }),
    invoice('full-advance', { advancePaid: 1200, dueDate: '2026-01-01' }),
    invoice('foreign', { currency: 'USD', dueDate: '2026-01-01' }),
  ], now);
  assert.deepEqual(rows, []);
});

test('malformed schedules fall back to invoice deadlines and invalid dates are ignored safely', () => {
  const rows = invoiceDueQueue([
    invoice('fallback', { dueDate: '2026-10-24', advancePaid: 100, paymentScheduleEnabled: true, paymentSchedule: [{ amountPaise: -100, dueDate: '2026-10-01' }] }),
    invoice('bad-date', { dueDate: '2026-99-99' }),
    invoice('rollover', { dueDate: '2026-02-30' }),
  ], now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amountDue, 900);
  assert.equal(rows[0].daysOverdue, 1);
});

test('queue and summary use the configured calendar date and retain paise precision', () => {
  const invoices = [invoice('today', { total: 10.01, advancePaid: 0.1, dueDate: '2026-10-25' })];
  assert.equal(invoiceDueQueue(invoices, now, 'America/Los_Angeles').length, 0);
  assert.equal(overviewFinanceTotals([], invoices, now, 'America/Los_Angeles').due, 0);
  assert.equal(invoiceDueQueue(invoices, now, 'Asia/Kolkata')[0].amountDue, 9.91);
  assert.equal(overviewFinanceTotals([], invoices, now, 'Asia/Kolkata').due, 9.91);
});
