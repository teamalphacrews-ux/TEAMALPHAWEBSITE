const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteDefaults, invoiceWithDefaults, paymentSchedule, communicationValues, linkIsActive } = require('../utils/documentDefaults');
const { invoiceFromQuote } = require('../utils/quoteLifecycle');
const invoiceValues = require('../utils/invoiceValues');
const { invoiceIssuer, validImage } = require('../utils/invoiceBranding');
const { nextDocumentNumber, financialYear } = require('../services/documentNumbering');
const Counter = require('../models/DocumentCounter');
const studio = { studioName: 'Team Alpha', legalName: 'Team Alpha Photography', gstin: '29ABCDE1234F1Z5', quotationValidityDays: 7, address: 'Bengaluru', billingDefaults: { quotationPrefix: 'ALPHA-Q', invoicePrefix: 'ALPHA-I', numberingMode: 'sequence', includeFinancialYear: true, defaultTaxPercent: 18, defaultDiscountType: 'percent', defaultDiscountValue: 10, invoiceDueDays: 21, paymentScheduleEnabled: true, paymentMilestones: [{ label: 'Booking', percent: 30, offsetDays: 0 }, { label: 'Before event', percent: 40, offsetDays: 7 }, { label: 'Balance', percent: 30, offsetDays: 21 }] }, automation: { autoCreateInvoice: false, invoiceRemindersEnabled: true, invoiceReminderDays: [2, 8], quoteRemindersEnabled: true, quoteReminderDays: [2, 5] } };
test('new document defaults use stored validity, money, due dates and reminder settings', () => {
  const q = quoteDefaults(studio, '2026-10-23');
  assert.equal(q.validUntil, '2026-10-30');
  assert.equal(quoteDefaults({ quotationValidityDays: 0 }, '2026-10-23').validUntil, '2026-10-23');
  assert.equal(quoteDefaults({}, new Date('2026-10-22T20:00:00Z')).issueDate, '2026-10-23');
  assert.equal(q.taxRateBps, 1800); assert.equal(q.discountValue, 10); assert.equal(q.autoCreateInvoice, false);
  assert.deepEqual(q.reminderDays, [2, 5]);
  const invoice = invoiceWithDefaults({ clientName: 'Client', invoiceDate: '2026-10-23', items: [{ title: 'Wedding', quantity: 1, unitPricePaise: 10001 }] }, studio, invoiceValues);
  assert.equal(invoice.dueDate.toISOString().slice(0, 10), '2026-11-13');
  assert.equal(invoice.discount, 10); assert.equal(invoice.taxAmount, 16.2); assert.equal(invoice.total, 106.21);
  assert.equal(invoice.documentStatus, 'Draft'); assert.deepEqual(invoice.reminderOffsets, [2, 8]);
  assert.equal(invoice.paymentSchedule.reduce((sum, row) => sum + row.amountPaise, 0), 10621);
  assert.equal(invoice.paymentSchedule[0].label, 'Booking');
});
test('milestone paise rounding and final due date remain exact', () => {
  const rows = paymentSchedule(101, '2026-10-23', '2026-11-13', studio.billingDefaults.paymentMilestones);
  assert.deepEqual(rows.map(row => row.amountPaise), [30, 40, 31]);
  assert.equal(rows.at(-1).dueDate, '2026-11-13');
  assert.deepEqual(paymentSchedule(100, '2026-10-23', '2026-10-23', studio.billingDefaults.paymentMilestones), []);
});
test('accepted quote invoice retains approved money and issuer snapshot and always awaits studio issue', () => {
  const quote = { _id: '507f1f77bcf86cd799439022', invoiceId: '507f1f77bcf86cd799439023', acceptedAt: '2026-10-23', clientName: 'Client', email: 'client@example.com', items: [{ title: 'Wedding', quantity: 1, unitPricePaise: 10000 }], discountType: 'amount', discountValue: 0, discountPaise: 0, taxRateBps: 0, taxPaise: 0, totalPaise: 10000, issuer: { name: 'Approved studio name', taxId: 'Approved GST' } };
  const invoice = invoiceFromQuote(quote, studio);
  assert.equal(invoice.documentStatus, 'Draft'); assert.equal(invoice.total, 100); assert.equal(invoice.taxRateBps, 0); assert.equal(invoice.discount, 0);
  assert.equal(invoice.issuer.name, 'Approved studio name'); assert.equal(invoice.issuer.taxId, 'Approved GST');
  assert.equal(invoiceValues(invoice).total, 100);
  assert.equal(invoiceIssuer(studio).taxId, studio.gstin); assert.equal(invoiceIssuer(studio).name, studio.legalName);
});
test('separate atomic sequences survive concurrent requests, duplicate insert races and legacy number collisions', async t => {
  const values = new Map(); let raced = false;
  t.mock.method(Counter, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(update, { $inc: { value: 1 } }); assert.equal(options.upsert, true); assert.equal(options.new, true);
    if (!raced) { raced = true; throw Object.assign(new Error('Concurrent first insert'), { code: 11000 }); }
    const value = (values.get(filter._id) || 0) + 1; values.set(filter._id, value); return { value };
  });
  const Model = { exists: async query => query.documentNumber === 'ALPHA-Q-2026-27-000001' };
  const result = await Promise.all(Array.from({ length: 40 }, () => nextDocumentNumber('quotation', studio, '2026-10-23', Model)));
  assert.equal(new Set(result).size, 40); assert.ok(result.every(value => value.startsWith('ALPHA-Q-2026-27-')));
  assert.ok(!result.includes('ALPHA-Q-2026-27-000001'));
  assert.equal(await nextDocumentNumber('invoice', studio, '2026-10-23'), 'ALPHA-I-2026-27-000001');
  assert.equal(financialYear('2026-03-31'), '2025-26'); assert.equal(financialYear('2026-04-01'), '2026-27');
});
test('communication supports documented placeholders and links expire or revoke independently of quotation acceptance', () => {
  assert.deepEqual(communicationValues({ studioName: 'Studio', communication: { quoteSubject: 'Quote {{documentNumber}}', quoteMessage: 'Hello {{clientName}} from {{studioName}}' } }, 'quote', { clientName: 'Asha', documentNumber: 'Q1' }), { subject: 'Quote Q1', message: 'Hello Asha from Studio' });
  assert.equal(linkIsActive({ linkExpiresAt: '2026-10-24' }, new Date('2026-10-23')), true);
  assert.equal(linkIsActive({ linkExpiresAt: '2026-10-23' }, new Date('2026-10-23')), false);
  assert.equal(linkIsActive({ linkRevokedAt: new Date() }), false);
  assert.equal(validImage('/api/studio/profile-images/507f1f77bcf86cd799439022'), true);
  assert.equal(validImage('/api/studio/profile-images/../secret'), false);
});
