import test from 'node:test';
import assert from 'node:assert/strict';
import { quotationDefaults, invoiceDefaults, defaultPaymentSchedule, invoiceScheduleToggle, documentCommunication, resolveStudioImage } from '../src/utils/settingsDefaults.js';
test('new document defaults use saved settings without changing existing records', () => {
  const settings = { quotationValidityDays: 0, billingDefaults: { invoiceDueDays: 7, defaultTaxPercent: 18, defaultDiscountType: 'percent', defaultDiscountValue: 5 }, automation: { autoCreateInvoice: false, quoteRemindersEnabled: true, quoteReminderDays: [2, 5] } };
  assert.equal(quotationDefaults(settings, '2026-10-23').validUntil, '2026-10-23');
  assert.equal(quotationDefaults({}, new Date('2026-10-22T20:00:00Z')).issueDate, '2026-10-23');
  assert.equal(quotationDefaults(settings, '2026-10-23').autoCreateInvoice, false);
  assert.equal(invoiceDefaults(settings, '2026-10-23').dueDate, '2026-10-30');
  assert.equal(invoiceDefaults(settings, '2026-10-23').taxRateBps, 1800);
  assert.deepEqual(defaultPaymentSchedule({}, 101, '2026-10-23', '2026-11-22').map(row => row.amountPaise), [30, 40, 31]);
});
test('message templates substitute allowed placeholders and public image URLs resolve to API origin', () => {
  assert.equal(documentCommunication({ communication: { invoiceSubject: 'Invoice {{documentNumber}} for {{clientName}}' } }, 'invoice', { clientName: 'Asha', documentNumber: 'I1' }).subject, 'Invoice I1 for Asha');
  assert.equal(resolveStudioImage('/api/studio/profile-images/507f1f77bcf86cd799439022', 'https://api.example'), 'https://api.example/api/studio/profile-images/507f1f77bcf86cd799439022');
  assert.equal(resolveStudioImage('/assets/logo.png', 'https://api.example'), '/assets/logo.png');
});
test('enabling installments before price entry keeps the default allocation responsive and preserves custom schedules', () => {
  const draft = invoiceScheduleToggle({ paymentSchedule: [], _useDefaultPaymentSchedule: false }, true);
  assert.equal(draft._useDefaultPaymentSchedule, true);
  const scheduleAt = total => draft._useDefaultPaymentSchedule ? defaultPaymentSchedule({}, total, '2026-10-31', '2026-11-30') : draft.paymentSchedule;
  assert.deepEqual(scheduleAt(0), []);
  const priced = scheduleAt(15000000);
  assert.ok(priced.every(row => row.amountPaise > 0));
  assert.equal(priced.reduce((sum, row) => sum + row.amountPaise, 0), 15000000);
  assert.equal(scheduleAt(20000000).reduce((sum, row) => sum + row.amountPaise, 0), 20000000);
  const custom = { paymentSchedule: [{ amountPaise: 4000000, dueDate: '2026-11-01' }, { amountPaise: 11000000, dueDate: '2026-11-30' }], _useDefaultPaymentSchedule: false };
  const restored = invoiceScheduleToggle(invoiceScheduleToggle(custom, false), true);
  assert.equal(restored._useDefaultPaymentSchedule, false);
  assert.deepEqual(restored.paymentSchedule, custom.paymentSchedule);
});
