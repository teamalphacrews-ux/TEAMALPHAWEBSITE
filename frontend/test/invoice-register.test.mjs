import test from 'node:test';
import assert from 'node:assert/strict';
import { invoicePaymentPlan } from '../src/admin/components/finance/invoicePaymentSchedule.js';
import { invoiceDueQueue, invoiceOutstandingBalance } from '../src/admin/components/finance/duePayments.js';
import { filterInvoiceRegister, invoiceRegisterEntries } from '../src/admin/components/finance/invoiceRegister.js';

const now = new Date('2026-10-24T20:00:00Z');
const invoice = (id, values = {}) => ({ _id: id, clientName: id, documentStatus: 'Sent', status: 'Pending', currency: 'INR', total: 1000, invoiceDate: '2026-10-01', ...values });
const scheduled = values => invoice('schedule', { paymentScheduleEnabled: true, paymentSchedule: [
  { label: 'Delivery', amountPaise: 50000, dueDate: '2026-11-01' },
  { label: 'Event', amountPaise: 30000, dueDate: '2026-10-25' },
  { label: 'Booking', amountPaise: 20000, dueDate: '2026-10-20' },
], ...values });

test('register and Finance allocate partial advances to the same earliest outstanding installment', () => {
  const source = scheduled({ advancePaid: 250 });
  const [row] = invoiceRegisterEntries([source], now);
  const [due] = invoiceDueQueue([source], now);
  assert.equal(row.balance, 750);
  assert.equal(row.balance, invoiceOutstandingBalance(source));
  assert.equal(row.nextDue.label, 'Event');
  assert.equal(row.nextDue.amountPaise, 25000);
  assert.equal(row.nextDue.dueDate, due.dueDate);
  assert.equal(row.nextDue.amountPaise / 100, due.amountDue);
  assert.equal(row.paymentStatus, 'Part paid');
  assert.equal(row.state, 'today');
  assert.equal(source.paymentSchedule[0].label, 'Delivery');
});

test('paid earlier installments do not leave stale overdue dates on the final payment', () => {
  const source = scheduled({ advancePaid: 500 });
  const entries = invoiceRegisterEntries([source], now);
  assert.equal(entries[0].nextDue.label, 'Delivery');
  assert.equal(entries[0].state, 'upcoming');
  assert.equal(entries[0].balance, 500);
  assert.deepEqual(filterInvoiceRegister(entries, { filter: 'overdue' }), []);
  assert.deepEqual(invoiceDueQueue([source], now), []);
});

test('draft, cancelled, settled and overpaid invoices cannot acquire collectible deadlines', () => {
  const entries = invoiceRegisterEntries([
    scheduled({ documentStatus: 'Draft', advancePaid: 100 }), scheduled({ documentStatus: 'Cancelled' }),
    scheduled({ status: 'Paid', advancePaid: 1 }), scheduled({ advancePaid: 1200 }),
  ], now);
  assert.deepEqual(entries.map(row => [row.balance, row.nextDue, row.paymentStatus]), [[0, null, 'Not issued'], [0, null, 'Closed'], [0, null, 'Paid'], [0, null, 'Paid']]);
  assert.deepEqual(filterInvoiceRegister(entries, { filter: 'outstanding' }), []);
});

test('invalid schedules safely fall back to the invoice deadline and retain paise', () => {
  for (const paymentSchedule of [[null], [{ amountPaise: 1000, dueDate: '2026-02-30' }], [{ amountPaise: 2000, dueDate: '2026-10-01' }]]) {
    const source = invoice('invalid', { total: 10.01, advancePaid: 0.10, dueDate: '2026-10-24', paymentScheduleEnabled: true, paymentSchedule });
    const plan = invoicePaymentPlan(source);
    assert.equal(plan.outstanding, 9.91);
    assert.equal(plan.installments[0].amountPaise, 991);
    assert.equal(plan.installments[0].dueDate, '2026-10-24');
    assert.equal(invoiceDueQueue([source], now)[0].amountDue, 9.91);
  }
  assert.equal(invoiceRegisterEntries([invoice('undated', { dueDate: '2026-02-30' })], now)[0].state, 'unscheduled');
});

test('overdue filter and ordering use studio day boundaries rather than browser dates', () => {
  const invoices = [invoice('today', { dueDate: '2026-10-25' }), invoice('late', { dueDate: '2026-10-24' }), invoice('oldest', { dueDate: '2026-10-20' }), invoice('future', { dueDate: '2026-11-01' })];
  const entries = invoiceRegisterEntries(invoices, now);
  assert.deepEqual(filterInvoiceRegister(entries, { filter: 'overdue' }).map(row => row.invoice._id), ['oldest', 'late']);
  assert.deepEqual(filterInvoiceRegister(entries).map(row => row.invoice._id), ['oldest', 'late', 'today', 'future']);
  assert.equal(invoiceRegisterEntries(invoices, now, 'America/Los_Angeles')[1].state, 'today');
  assert.equal(invoiceRegisterEntries(invoices, now, 'America/Los_Angeles')[0].state, 'upcoming');
});

test('register preserves currencies and separates document state from payment state', () => {
  const source = invoice('foreign', { currency: 'USD', documentNumber: 'TA-42', title: 'Portrait session', advancePaid: 50, dueDate: '2026-10-24' });
  const entries = invoiceRegisterEntries([source], now);
  assert.equal(entries[0].documentStatus, 'Sent');
  assert.equal(entries[0].paymentStatus, 'Part paid');
  assert.equal(entries[0].invoice.currency, 'USD');
  assert.equal(filterInvoiceRegister(entries, { query: '  portrait  ', filter: 'overdue' }).length, 1);
  assert.deepEqual(invoiceDueQueue([source], now), []);
});
