const toPaise = value => {
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
};
const deadline = value => {
  const key = String(value || '').slice(0, 10);
  const date = new Date(`${key}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : '';
};
export const inactiveInvoice = invoice => ['Draft', 'Cancelled', 'Archived'].includes(invoice.documentStatus) || ['Paid', 'Cancelled'].includes(invoice.status);

// Allocate advances to the earliest installments in paise. Both the invoice
// register and Finance use this plan so a partially paid deadline stays aligned.
export function invoicePaymentPlan(invoice) {
  if (inactiveInvoice(invoice)) return { outstanding: 0, installments: [] };
  const total = toPaise(invoice.total);
  let paid = Math.min(total, toPaise(invoice.advancePaid));
  const outstanding = total - paid;
  if (!outstanding) return { outstanding: 0, installments: [] };
  const schedule = invoice.paymentScheduleEnabled && Array.isArray(invoice.paymentSchedule) ? [...invoice.paymentSchedule] : [];
  const validSchedule = schedule.length && schedule.every(item => item && Number.isSafeInteger(item.amountPaise) && item.amountPaise > 0 && deadline(item.dueDate)) && schedule.reduce((sum, item) => sum + item.amountPaise, 0) === total;
  const installments = (validSchedule ? schedule.sort((a, b) => deadline(a.dueDate).localeCompare(deadline(b.dueDate))) : [{ amountPaise: total, dueDate: invoice.dueDate, label: 'Invoice balance' }]).flatMap(installment => {
    const applied = Math.min(paid, installment.amountPaise);
    paid -= applied;
    const amountPaise = installment.amountPaise - applied;
    return amountPaise > 0 ? [{ label: installment.label || 'Scheduled payment', dueDate: deadline(installment.dueDate), amountPaise }] : [];
  });
  return { outstanding: outstanding / 100, installments };
}

export const invoiceOutstandingBalance = invoice => invoicePaymentPlan(invoice).outstanding;
