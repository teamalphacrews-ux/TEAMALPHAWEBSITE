import defaults from '../admin/studio-settings-defaults.json' with { type: 'json' };

const day = value => new Date(value).toISOString().slice(0, 10);
function studioDay(studio, value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return day(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: studio.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
export const addDocumentDays = (value, count) => day(Date.parse(day(value)) + count * 86400000);
export function documentSettings(studio = {}) {
  return {
    billing: { ...defaults.billingDefaults, ...studio.billingDefaults },
    automation: { ...defaults.automation, ...studio.automation },
    communication: { ...defaults.communication, ...studio.communication },
  };
}
export function quotationDefaults(studio = {}, now = Date.now()) {
  const { billing, automation } = documentSettings(studio);
  const issueDate = studioDay(studio, now);
  return {
    issueDate,
    validUntil: addDocumentDays(issueDate, studio.quotationValidityDays ?? 14),
    discountType: billing.defaultDiscountType,
    discountValue: billing.defaultDiscountValue,
    taxRateBps: Math.round(billing.defaultTaxPercent * 100),
    autoCreateInvoice: automation.autoCreateInvoice,
    remindersEnabled: automation.quoteRemindersEnabled,
    reminderDays: automation.quoteReminderDays,
  };
}
export function invoiceDefaults(studio = {}, now = Date.now()) {
  const { billing, automation } = documentSettings(studio);
  const invoiceDate = studioDay(studio, now);
  return {
    invoiceDate, dueDate: addDocumentDays(invoiceDate, billing.invoiceDueDays),
    discountType: billing.defaultDiscountType === 'percent' ? 'percent' : 'fixed',
    discountValue: billing.defaultDiscountValue,
    taxRateBps: Math.round(billing.defaultTaxPercent * 100),
    paymentScheduleEnabled: billing.paymentScheduleEnabled,
    paymentReminders: automation.invoiceRemindersEnabled,
    reminderOffsets: automation.invoiceReminderDays,
  };
}
export function defaultPaymentSchedule(studio, totalPaise, invoiceDate, dueDate) {
  const { billing } = documentSettings(studio);
  const milestones = billing.paymentMilestones;
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || milestones.length < 2 || !invoiceDate || !dueDate) return [];
  const duration = Math.round((Date.parse(dueDate) - Date.parse(invoiceDate)) / 86400000);
  if (duration < 1) return [];
  let allocated = 0;
  return milestones.map((milestone, index) => {
    const final = index === milestones.length - 1;
    const amountPaise = final ? totalPaise - allocated : Math.floor(totalPaise * Math.round(milestone.percent * 100) / 10000);
    allocated += amountPaise;
    return { label: milestone.label, amountPaise, dueDate: final ? dueDate : addDocumentDays(invoiceDate, Math.min(milestone.offsetDays, duration - 1)) };
  });
}
export function documentCommunication(studio = {}, kind, document = {}) {
  const { communication } = documentSettings(studio);
  const fields = { studioName: studio.studioName || 'Team Alpha', clientName: document.clientName || '', documentNumber: document.documentNumber || '', dueDate: document.dueDate ? day(document.dueDate) : '' };
  const fill = value => value.replace(/\{\{(clientName|studioName|documentNumber|dueDate)\}\}/g, (_, key) => fields[key]);
  const quote = kind === 'quote';
  return {
    subject: fill(communication[quote ? 'quoteSubject' : 'invoiceSubject'] || (quote ? 'Your quotation from {{studioName}}' : 'Invoice {{documentNumber}} from {{studioName}}')),
    message: fill(communication[quote ? 'quoteMessage' : 'invoiceMessage'] || (quote ? 'Hi {{clientName}},\n\nPlease review your quotation using the link below.\n\nThank you,\n{{studioName}}' : 'Hi {{clientName}},\n\nPlease review your invoice and payment schedule using the link below.\n\nThank you,\n{{studioName}}')),
  };
}
export function resolveStudioImage(url, apiOrigin = '') {
  return /^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(url || '') ? apiOrigin.replace(/\/$/, '') + url : url;
}
