import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentOptions } from '../src/utils/clientPayment.js';

const invoice = (values = {}) => ({ documentStatus: 'Sent', status: 'Pending', currency: 'INR', total: 1000, advancePaid: 150, documentNumber: 'TA-INV-2026/42', dueDate: '2026-11-01', acceptedPaymentMethods: ['BANKING', 'UPI'], studio: { name: 'Team Alpha & Co', upiId: ' team.alpha@okaxis ', bankDetails: 'Account holder: Team Alpha\nAccount: 123456\nIFSC: SAMPLE0001' }, ...values });

test('issued INR invoice exposes saved bank text and a generic encoded UPI handoff', () => {
  const result = paymentOptions(invoice());
  assert.equal(result.available, true);
  assert.equal(result.amountPaise, 85000);
  assert.equal(result.balancePaise, 85000);
  assert.equal(result.upiId, 'team.alpha@okaxis');
  assert.equal(result.bankDetails, invoice().studio.bankDetails);
  assert.equal(result.reference, 'TA-INV-2026/42');
  assert.equal(result.payee, 'Team Alpha & Co');
  assert.equal(result.reason, '');
  const uri = new URL(result.upiUrl);
  assert.equal(uri.protocol, 'upi:');
  assert.equal(uri.hostname, 'pay');
  assert.deepEqual([...uri.searchParams.keys()], ['pa', 'pn', 'am', 'cu', 'tn']);
  assert.equal(uri.searchParams.get('pa'), 'team.alpha@okaxis');
  assert.equal(uri.searchParams.get('pn'), 'Team Alpha & Co');
  assert.equal(uri.searchParams.get('am'), '850.00');
  assert.equal(uri.searchParams.get('cu'), 'INR');
  assert.equal(uri.searchParams.get('tn'), 'TA-INV-2026/42');
  assert.match(result.upiUrl, /Team%20Alpha%20%26%20Co/);
});

test('selection is in integer paise and never exceeds the confirmed outstanding balance', () => {
  assert.equal(new URL(paymentOptions(invoice(), { amountPaise: 1001 }).upiUrl).searchParams.get('am'), '10.01');
  assert.equal(new URL(paymentOptions(invoice(), { amountPaise: 1 }).upiUrl).searchParams.get('am'), '0.01');
  assert.equal(paymentOptions(invoice(), { amountPaise: 85001 }).reason, 'amount_exceeds_balance');
  for (const amountPaise of [-1, 0, 1.5, NaN, Infinity, '1000', null]) {
    const result = paymentOptions(invoice(), { amountPaise });
    assert.equal(result.available, false);
    assert.equal(result.reason, 'invalid_amount');
    assert.equal(result.upiUrl, '');
    assert.equal(result.bankDetails, '');
  }
});

test('default selects the earliest outstanding installment, with no invoice mutation', () => {
  const document = invoice({ paymentScheduleEnabled: true, paymentSchedule: [
    { label: 'Delivery', amountPaise: 50000, dueDate: '2026-12-01' },
    { label: 'Event', amountPaise: 30000, dueDate: '2026-11-01' },
    { label: 'Booking', amountPaise: 20000, dueDate: '2026-10-01' },
  ] });
  const copy = structuredClone(document);
  const result = paymentOptions(document);
  assert.equal(result.amountPaise, 5000);
  assert.equal(result.balancePaise, 85000);
  assert.deepEqual(document, copy);
  assert.equal(paymentOptions({ ...document, paymentSchedule: [null] }).amountPaise, 85000);
});

test('drafts, cancelled, settled and financially unknown invoices cannot generate payment links', () => {
  for (const document of [undefined, invoice({ documentStatus: 'Draft' }), invoice({ documentStatus: 'Cancelled' }), invoice({ status: 'Cancelled' }), invoice({ status: 'Paid' }), invoice({ advancePaid: 1000 }), invoice({ advancePaid: undefined }), invoice({ total: -1 }), invoice({ total: 'invalid' })]) {
    const result = paymentOptions(document);
    assert.equal(result.available, false);
    assert.equal(result.upiUrl, '');
    assert.equal(result.bankDetails, '');
  }
  assert.equal(paymentOptions(invoice({ status: 'Paid', advancePaid: 10 })).reason, 'paid_in_full');
  assert.equal(paymentOptions(invoice({ advancePaid: undefined })).reason, 'balance_unavailable');
});

test('currency must be explicitly INR and unsupported currencies are never converted', () => {
  for (const currency of ['USD', 'EUR', 'inr', undefined, null, '']) {
    const result = paymentOptions(invoice({ currency }));
    assert.equal(result.available, false);
    assert.equal(result.reason, 'currency_unsupported');
    assert.equal(result.amountPaise, null);
    assert.equal(result.upiUrl, '');
  }
});

test('only explicitly accepted bank or UPI methods expose their saved destinations', () => {
  const bank = paymentOptions(invoice({ acceptedPaymentMethods: ['BANKING'] }));
  assert.equal(bank.available, true);
  assert.ok(bank.bankDetails);
  assert.equal(bank.upiId, '');
  assert.equal(bank.upiUrl, '');
  for (const method of ['UPI', 'G-pay']) {
    const upi = paymentOptions(invoice({ acceptedPaymentMethods: [method] }));
    assert.equal(upi.available, true);
    assert.ok(upi.upiUrl);
    assert.equal(upi.bankDetails, '');
  }
  for (const acceptedPaymentMethods of [undefined, [], ['CASH'], ['https://example.com/pay'], ['upi']]) {
    const result = paymentOptions(invoice({ acceptedPaymentMethods }));
    assert.equal(result.available, false);
    assert.equal(result.reason, 'payment_methods_unavailable');
    assert.equal(result.upiUrl, '');
    assert.equal(result.bankDetails, '');
  }
});

test('VPA validation rejects arbitrary protocols, injected fields, whitespace and malformed handles', () => {
  for (const upiId of ['javascript:alert(1)', 'https://evil.example/pay', 'upi://pay?pa=evil@upi', 'team@upi?url=https://evil.example', 'team@upi&am=1', 'team alpha@upi', 'team%40alpha@upi', 'team@@upi', '.team@upi', 'team@u', 'team..alpha@upi', 'team@upi\n&pa=evil@upi']) {
    const result = paymentOptions(invoice({ acceptedPaymentMethods: ['UPI'], studio: { ...invoice().studio, upiId } }));
    assert.equal(result.available, false, upiId);
    assert.equal(result.upiUrl, '');
    assert.equal(result.upiId, '');
  }
});

test('handoff selects public payment fields only and never embeds quote tokens or callback URLs', () => {
  const token = 'f'.repeat(64);
  const result = paymentOptions(invoice({ shareToken: token, shareTokenHash: token, sourceQuotation: token, callbackUrl: 'https://evil.example/' + token, studio: { ...invoice().studio, webhookSecret: token } }));
  assert.equal(JSON.stringify(result).includes(token), false);
  const uri = new URL(result.upiUrl);
  assert.equal(uri.searchParams.has('url'), false);
  assert.equal(uri.searchParams.has('callback'), false);
  assert.equal(uri.searchParams.has('tr'), false);
  assert.equal(paymentOptions(invoice({ documentNumber: token, acceptedPaymentMethods: ['UPI'] })).upiUrl, '');
  assert.equal(paymentOptions(invoice({ documentNumber: 'https://evil.example/pay', acceptedPaymentMethods: ['UPI'] })).upiUrl, '');
});

test('bank instructions stay plain text and unusable recipient metadata never creates an app link', () => {
  const bankDetails = '<b>Sample bank</b>\nAccount: 123456';
  assert.equal(paymentOptions(invoice({ studio: { ...invoice().studio, bankDetails }, acceptedPaymentMethods: ['BANKING'] })).bankDetails, bankDetails);
  assert.equal(paymentOptions(invoice({ studio: { ...invoice().studio, bankDetails: '   ' }, acceptedPaymentMethods: ['BANKING'] })).available, false);
  assert.equal(paymentOptions(invoice({ studio: { ...invoice().studio, name: '' }, acceptedPaymentMethods: ['UPI'] })).available, false);
  assert.equal(paymentOptions(invoice({ studio: { ...invoice().studio, name: 'Studio\nInjected' }, acceptedPaymentMethods: ['UPI'] })).available, false);
});
