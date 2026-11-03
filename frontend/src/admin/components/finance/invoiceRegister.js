import { dayKeyDifference, studioDayKey, DEFAULT_STUDIO_TIMEZONE } from '../../../utils/studioTime.js';
import { invoicePaymentPlan } from './invoicePaymentSchedule.js';

export function invoiceRegisterEntries(invoices = [], now = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
  const today = studioDayKey(now, timezone);
  return invoices.map(invoice => {
    const { outstanding: balance, installments } = invoicePaymentPlan(invoice);
    const documentStatus = invoice.documentStatus || (invoice.status === 'Cancelled' ? 'Cancelled' : 'Sent');
    const inactive = ['Draft', 'Cancelled', 'Archived'].includes(documentStatus) || invoice.status === 'Cancelled';
    const nextDue = installments[0] || null;
    const daysOverdue = nextDue?.dueDate ? Math.max(0, dayKeyDifference(today, nextDue.dueDate)) : 0;
    const state = inactive ? 'inactive' : !balance ? 'paid' : !nextDue?.dueDate ? 'unscheduled' : daysOverdue ? 'overdue' : nextDue.dueDate === today ? 'today' : 'upcoming';
    const paymentStatus = documentStatus === 'Draft' ? 'Not issued' : inactive ? 'Closed' : !balance ? 'Paid' : Number(invoice.advancePaid) > 0 ? 'Part paid' : 'Unpaid';
    return { invoice, documentStatus, paymentStatus, balance, nextDue, daysOverdue, state };
  });
}

export function filterInvoiceRegister(entries, { query = '', filter = 'all', sort = 'overdue' } = {}) {
  const search = query.trim().toLowerCase();
  const rows = entries.filter(row => {
    if (filter === 'outstanding' ? !row.balance : filter === 'draft' ? row.documentStatus !== 'Draft' : filter !== 'all' && row.state !== filter) return false;
    return [row.invoice.clientName, row.invoice.invoiceNumber, row.invoice.documentNumber, row.invoice.title, row.documentStatus, row.paymentStatus].join(' ').toLowerCase().includes(search);
  });
  const nextDeadline = row => row.nextDue?.dueDate || '9999-12-31';
  const newest = row => Date.parse(row.invoice.invoiceDate || row.invoice.createdAt) || 0;
  return rows.sort((first, second) => {
    if (sort === 'newest') return newest(second) - newest(first);
    if (sort === 'balance') return second.balance - first.balance || nextDeadline(first).localeCompare(nextDeadline(second));
    if (sort === 'overdue') {
      const overdueFirst = Number(second.state === 'overdue') - Number(first.state === 'overdue');
      if (overdueFirst) return overdueFirst;
    }
    return nextDeadline(first).localeCompare(nextDeadline(second)) || newest(second) - newest(first) || String(first.invoice._id || '').localeCompare(String(second.invoice._id || ''));
  });
}
