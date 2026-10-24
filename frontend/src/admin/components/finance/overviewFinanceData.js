import { contactPaymentTotals } from '../contacts/contactPaymentTotals.js';

const paise = value => {
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
};

export function overviewFinanceTotals(entries = [], invoices = [], now = new Date()) {
  let income = 0, expenses = 0;
  for (const entry of entries) {
    if (entry.type === 'income' && ['Received', 'Paid'].includes(entry.status)) income += paise(entry.amount);
    if (entry.type === 'expense' && entry.status === 'Paid') expenses += paise(entry.amount);
  }
  const rupeeInvoices = invoices.filter(invoice => !invoice.currency || invoice.currency === 'INR');
  const balances = contactPaymentTotals(rupeeInvoices, now, { includeDueToday: true });
  return { upcoming: balances.upcoming, due: balances.pastDue, netProfit: (income - expenses) / 100,
    income: income / 100, expenses: expenses / 100, excludedCurrencies: invoices.length - rupeeInvoices.length };
}
