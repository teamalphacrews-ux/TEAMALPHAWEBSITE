import { dayKeyDifference, studioDayKey, DEFAULT_STUDIO_TIMEZONE } from '../../../utils/studioTime.js';
import { inactiveInvoice, invoicePaymentPlan } from './invoicePaymentSchedule.js';
export { invoiceOutstandingBalance } from './invoicePaymentSchedule.js';

export function invoiceDueQueue(invoices = [], now = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
  const today = studioDayKey(now, timezone);
  return invoices.flatMap(invoice => {
    if ((invoice.currency && invoice.currency !== 'INR') || inactiveInvoice(invoice)) return [];
    const { outstanding, installments } = invoicePaymentPlan(invoice);
    if (!outstanding) return [];
    const due = installments.filter(installment => installment.dueDate && installment.dueDate <= today);
    if (!due.length) return [];
    const dueDate = due[0].dueDate;
    return [{ invoice, dueDate, daysOverdue: Math.max(0, dayKeyDifference(today, dueDate)), amountDue: due.reduce((sum, item) => sum + item.amountPaise, 0) / 100, outstanding, installments: due }];
  }).sort((first, second) => first.dueDate.localeCompare(second.dueDate) || String(first.invoice.clientName || '').localeCompare(String(second.invoice.clientName || '')) || String(first.invoice._id || '').localeCompare(String(second.invoice._id || '')));
}
