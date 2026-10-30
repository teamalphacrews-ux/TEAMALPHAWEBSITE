import { clientDashboardSummary, clientPaymentRows } from './clientDashboardData.js';

const unsafeControl = (value, multiline = false) => [...value].some(character => { const code = character.codePointAt(0); return code === 127 || (code < 32 && !(multiline && [9, 10, 13].includes(code))); });
const text = (value, limit) => typeof value === 'string' && !unsafeControl(value) ? value.trim().slice(0, limit) : '';
const bankText = value => typeof value === 'string' && !unsafeControl(value, true) ? value.trim().slice(0, 4000) : '';
const validUpiId = value => value.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}[A-Za-z0-9]@[A-Za-z0-9][A-Za-z0-9.-]{0,30}[A-Za-z0-9]$/.test(value) && !value.includes('..');
const referenceText = value => {
  const reference = text(value, 80);
  return /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,79}$/.test(reference) && !/^[a-f\d]{64}$/i.test(reference) ? reference : '';
};
const decimalAmount = paise => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

/** A bank/UPI handoff only. Opening a payment app never confirms receipt. */
export function paymentOptions(invoice, { amountPaise } = {}) {
  const result = { available: false, amountPaise: null, balancePaise: null, upiId: '', upiUrl: '', bankDetails: '', reference: '', payee: '', reason: 'invoice_unavailable' };
  if (!invoice || invoice.documentStatus !== 'Sent' || invoice.status === 'Cancelled') return result;
  if (invoice.currency !== 'INR') return { ...result, reason: 'currency_unsupported' };
  const summary = clientDashboardSummary({ project: { visibility: { showPayments: true }, invoice: { state: 'issued', document: invoice } } });
  if (!summary.payments.available || summary.payments.balance === null) return { ...result, reason: 'balance_unavailable' };
  const balancePaise = Math.round(summary.payments.balance * 100);
  if (!Number.isSafeInteger(balancePaise) || balancePaise < 0) return { ...result, reason: 'balance_unavailable' };
  result.balancePaise = balancePaise;
  if (!balancePaise) return { ...result, reason: 'paid_in_full' };
  const next = clientPaymentRows(invoice).find(row => row.remaining > 0);
  const selected = amountPaise === undefined ? next?.remaining ?? balancePaise : amountPaise;
  if (!Number.isSafeInteger(selected) || selected <= 0) return { ...result, reason: 'invalid_amount' };
  if (selected > balancePaise) return { ...result, reason: 'amount_exceeds_balance' };
  result.amountPaise = selected;
  result.reference = referenceText(invoice.documentNumber);
  result.payee = text(invoice.studio?.name, 120);
  const methods = Array.isArray(invoice.acceptedPaymentMethods) ? invoice.acceptedPaymentMethods : [];
  if (methods.includes('BANKING')) result.bankDetails = bankText(invoice.studio?.bankDetails);
  const upi = typeof invoice.studio?.upiId === 'string' ? invoice.studio.upiId.trim() : '';
  if (methods.some(method => ['UPI', 'G-pay'].includes(method)) && validUpiId(upi) && result.payee && result.reference) {
    result.upiId = upi;
    const fields = [['pa', upi], ['pn', result.payee], ['am', decimalAmount(selected)], ['cu', 'INR'], ['tn', result.reference]];
    result.upiUrl = 'upi://pay?' + fields.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  }
  result.available = Boolean(result.upiUrl || result.bankDetails);
  result.reason = result.available ? '' : 'payment_methods_unavailable';
  return result;
}
