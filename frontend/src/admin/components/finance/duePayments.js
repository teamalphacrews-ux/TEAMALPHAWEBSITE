import { dayKeyDifference, studioDayKey, DEFAULT_STUDIO_TIMEZONE } from '../../../utils/studioTime.js';

const toPaise = value => {
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
};
const deadline = value => {
  const key = String(value || '').slice(0, 10);
  const date = new Date(`${key}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : '';
};
const inactiveInvoice = invoice => ['Draft', 'Cancelled', 'Archived'].includes(invoice.documentStatus) || ['Paid', 'Cancelled'].includes(invoice.status);
export const invoiceOutstandingBalance = invoice => inactiveInvoice(invoice) ? 0 : Math.max(0, toPaise(invoice.total) - Math.min(toPaise(invoice.total), toPaise(invoice.advancePaid))) / 100;

export function invoiceDueQueue(invoices = [], now = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
  const today = studioDayKey(now, timezone);
  return invoices.flatMap(invoice => {
    if ((invoice.currency && invoice.currency !== 'INR') || inactiveInvoice(invoice)) return [];
    const total = toPaise(invoice.total);
    let paid = Math.min(total, toPaise(invoice.advancePaid));
    const outstanding = total - paid;
    if (!outstanding) return [];
    const schedule = invoice.paymentScheduleEnabled && Array.isArray(invoice.paymentSchedule) ? [...invoice.paymentSchedule] : [];
    const validSchedule = schedule.length && schedule.every(item => Number.isSafeInteger(item.amountPaise) && item.amountPaise > 0 && deadline(item.dueDate)) && schedule.reduce((sum, item) => sum + item.amountPaise, 0) === total;
    const installments = validSchedule ? schedule.sort((a, b) => deadline(a.dueDate).localeCompare(deadline(b.dueDate))) : [{ amountPaise: total, dueDate: invoice.dueDate, label: 'Invoice balance' }];
    const due = [];
    for (const installment of installments) {
      const applied = Math.min(paid, installment.amountPaise);
      paid -= applied;
      const amount = installment.amountPaise - applied;
      const date = deadline(installment.dueDate);
      if (amount > 0 && date && date <= today) due.push({ label: installment.label || 'Scheduled payment', dueDate: date, amountPaise: amount });
    }
    if (!due.length) return [];
    const dueDate = due[0].dueDate;
    return [{ invoice, dueDate, daysOverdue: Math.max(0, dayKeyDifference(today, dueDate)), amountDue: due.reduce((sum, item) => sum + item.amountPaise, 0) / 100, outstanding: outstanding / 100, installments: due }];
  }).sort((first, second) => first.dueDate.localeCompare(second.dueDate) || String(first.invoice.clientName || '').localeCompare(String(second.invoice.clientName || '')) || String(first.invoice._id || '').localeCompare(String(second.invoice._id || '')));
}
