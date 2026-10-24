import { invoiceDueQueue, invoiceOutstandingBalance } from './duePayments.js';

const paise = value => {
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
};

export function overviewFinanceTotals(entries = [], invoices = [], now = new Date(), timezone = 'Asia/Kolkata') {
  let income = 0, expenses = 0;
  for (const entry of entries) {
    if (entry.type === 'income' && ['Received', 'Paid'].includes(entry.status)) income += paise(entry.amount);
    if (entry.type === 'expense' && entry.status === 'Paid') expenses += paise(entry.amount);
  }
  const rupeeInvoices = invoices.filter(invoice => !invoice.currency || invoice.currency === 'INR');
  const outstanding = rupeeInvoices.reduce((sum, invoice) => sum + Math.round(invoiceOutstandingBalance(invoice) * 100), 0) / 100;
  const due = invoiceDueQueue(rupeeInvoices, now, timezone).reduce((sum, row) => sum + Math.round(row.amountDue * 100), 0) / 100;
  return { upcoming: Math.max(0, Math.round((outstanding - due) * 100) / 100), due, netProfit: (income - expenses) / 100,
    income: income / 100, expenses: expenses / 100, excludedCurrencies: invoices.length - rupeeInvoices.length };
}
