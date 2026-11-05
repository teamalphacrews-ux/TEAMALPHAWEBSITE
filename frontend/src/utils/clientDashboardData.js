import { studioDayKey } from './studioTime.js';

const publicQuoteStates = new Set(['Sent', 'Accepted', 'Expired']);
const invoiceStates = new Set(['preparing', 'awaiting_approval', 'issued', 'cancelled', 'hidden']);
const productionStates = new Set(['awaiting_invoice', 'not_started', 'in_progress', 'delivered', 'deliveries_only', 'hidden']);
const stages = new Set(['Not started', 'In progress', 'Editing', 'In review', 'Awaiting your selection', 'Ready', 'Uploaded to Drive', 'Delivered']);
const finished = new Set(['Uploaded to Drive', 'Delivered']);
const ready = new Set(['Ready', 'Uploaded to Drive', 'Delivered']);
const text = value => typeof value === 'string' ? value : '';
const amountPaise = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};
const integerPaise = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const dateKey = value => {
  const key = text(value).slice(0, 10);
  const instant = Date.parse(`${key}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === key ? key : null;
};
const safeCurrency = value => /^[A-Z]{3}$/.test(text(value)) ? value : 'INR';
const publishedUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};

function invoiceAmounts(document) {
  if (!document || document.documentStatus !== 'Sent' || document.status === 'Cancelled') return { total: null, paid: null };
  const total = amountPaise(document.total), recordedPaid = amountPaise(document.advancePaid);
  const paid = total === null ? null : document.status === 'Paid' ? total : recordedPaid === null ? (total === 0 ? 0 : null) : Math.min(total, recordedPaid);
  return { total, paid };
}

function publicPayments(document, now, { total, paid } = invoiceAmounts(document)) {
  const balance = total !== null && paid !== null ? (total - paid) / 100 : null;
  if (balance === null) return { available: false, balance: null, dueNow: null, next: null, scheduleKnown: false, rows: [] };
  const scheduleEnabled = document.paymentScheduleEnabled === true;
  const source = Array.isArray(document.paymentSchedule) ? document.paymentSchedule : [];
  const validSchedule = source.length > 0 && source.every(item => item && typeof item === 'object' && integerPaise(item.amountPaise) !== null && item.amountPaise > 0 && dateKey(item.dueDate)) && source.reduce((sum, item) => sum + item.amountPaise, 0) === total;
  if (scheduleEnabled && !validSchedule) return { available: true, balance, dueNow: balance === 0 ? 0 : null, next: null, scheduleKnown: false, rows: [] };
  const installments = scheduleEnabled
    ? [...source].sort((first, second) => dateKey(first.dueDate).localeCompare(dateKey(second.dueDate)))
    : [{ label: 'Invoice balance', amountPaise: total, dueDate: document.dueDate }];
  const today = studioDayKey(now, 'Asia/Kolkata');
  let credit = paid;
  const rows = installments.map((item, index) => {
    const applied = Math.min(item.amountPaise, credit);
    credit -= applied;
    const remaining = item.amountPaise - applied;
    const dueDate = dateKey(item.dueDate);
    return { number: index + 1, label: text(item.label) || 'Scheduled payment', dueDate, amountPaise: item.amountPaise, remaining, state: !remaining ? 'Paid' : !dueDate ? 'Awaiting date' : dueDate < today ? 'Overdue' : dueDate === today ? 'Due today' : 'Upcoming' };
  });
  const outstanding = rows.filter(item => item.remaining > 0);
  const first = outstanding[0];
  return { available: true, balance, rows, next: first ? { label: first.label, dueDate: first.dueDate, amount: first.remaining / 100, state: first.state } : null, scheduleKnown: true,
    dueNow: outstanding.some(item => !item.dueDate) ? null : outstanding.filter(item => item.dueDate <= today).reduce((sum, item) => sum + item.remaining, 0) / 100 };
}

/** The payment accordion and summary use exactly the same confirmed amounts. */
export const clientPaymentRows = (document, now = new Date()) => publicPayments(document, now).rows;

/** Summary cards consume only the public quotation + public project responses.
 * Null amounts/counts mean unavailable or hidden, rather than a guessed zero. */
export function clientDashboardSummary({ quote = null, project = null, now = new Date() } = {}) {
  const visibility = project?.visibility || {};
  const quoteVisible = !!quote && publicQuoteStates.has(quote.status);
  const quoteTotal = quoteVisible ? integerPaise(quote.totalPaise) : null;
  const quoteStatus = !quoteVisible ? 'Unavailable' : quote.status !== 'Accepted' && quote.expiryEnabled !== false && Number.isFinite(Date.parse(quote.expiresAt)) && Date.parse(quote.expiresAt) <= Number(now) ? 'Expired' : quote.status;
  const paymentVisible = !!project && visibility.showPayments !== false && project.invoice?.state !== 'hidden';
  const invoiceState = !project ? 'loading' : !paymentVisible ? 'hidden' : invoiceStates.has(project.invoice?.state) ? project.invoice.state : 'preparing';
  const document = paymentVisible && invoiceState === 'issued' && project.invoice?.document?.documentStatus === 'Sent' && project.invoice.document.status !== 'Cancelled' ? project.invoice.document : null;
  const amounts = invoiceAmounts(document), { total, paid } = amounts;
  const { rows: _paymentRows, ...payments } = publicPayments(document, now, amounts);
  const progressVisible = !!project && visibility.showProgress !== false;
  const deliverablesVisible = !!project && visibility.showDeliverables !== false;
  const productionVisible = (progressVisible || deliverablesVisible) && project.production?.state !== 'hidden';
  const productionState = !project ? 'loading' : !productionVisible ? 'hidden' : !progressVisible ? 'deliveries_only' : productionStates.has(project.production?.state) ? project.production.state : 'not_started';
  const hasDeliveries = Array.isArray(project?.production?.deliveries);
  const deliveries = hasDeliveries ? project.production.deliveries.filter(item => item && typeof item === 'object') : [];
  const canCount = progressVisible && ['in_progress', 'delivered'].includes(productionState) && hasDeliveries && deliveries.length === project.production.deliveries.length;
  const completed = canCount ? deliveries.filter(item => finished.has(item.stage)).length : null;
  const totalDeliveries = canCount ? deliveries.length : null;
  const knownStages = deliveries.every(item => stages.has(item.stage));
  return {
    quotation: { visible: quoteVisible, status: quoteStatus, number: quoteVisible ? text(quote.documentNumber) : '', total: quoteTotal === null ? null : quoteTotal / 100, currency: safeCurrency(quote?.currency), acceptedAt: quoteVisible && quoteStatus === 'Accepted' && typeof quote.acceptedAt === 'string' && Number.isFinite(Date.parse(quote.acceptedAt)) ? quote.acceptedAt : null },
    invoice: { visible: paymentVisible, state: invoiceState, available: !!document, number: paymentVisible ? text(document?.documentNumber || project.invoice?.number) : '', total: total === null ? null : total / 100, paid: paid === null ? null : paid / 100, balance: payments.balance, currency: document ? safeCurrency(document.currency) : null },
    payments: { visible: paymentVisible, ...payments },
    production: { visible: productionVisible, state: productionState, progressVisible, deliverablesVisible, total: totalDeliveries, completed,
      completionPercent: canCount && totalDeliveries > 0 && knownStages ? Math.round(completed / totalDeliveries * 100) : null,
      ready: canCount ? deliveries.filter(item => ready.has(item.stage)).length : null,
      published: deliverablesVisible && productionVisible && hasDeliveries && ['in_progress', 'delivered', 'deliveries_only'].includes(productionState) ? deliveries.filter(item => publishedUrl(item.url)).length : null },
  };
}
