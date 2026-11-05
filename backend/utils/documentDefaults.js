const DAY = 86400000;
const { DEFAULTS } = require('./studioSettings');
const plain = value => value?.toObject?.() || value || {};
const integer = (value, fallback, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;
function dateOnly(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(+date)) throw Object.assign(new Error('Invalid document date.'), { status: 400 });
  return date.toISOString().slice(0, 10);
}
function addDays(value, days) { return dateOnly(Date.parse(dateOnly(value)) + days * DAY); }
function studioDay(studio, value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly(value);
  dateOnly(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: studio.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
function billingDefaults(studio = {}) {
  const value = plain(studio.billingDefaults);
  const legacy = studio.invoicePrefix || 'TA';
  return {
    quotationPrefix: value.quotationPrefix || `${legacy}-Q`,
    invoicePrefix: value.invoicePrefix || `${legacy}-INV`,
    numberingMode: value.numberingMode === 'sequence' ? 'sequence' : 'reference',
    includeFinancialYear: value.includeFinancialYear === true,
    defaultTaxPercent: Number.isFinite(value.defaultTaxPercent) ? value.defaultTaxPercent : 0,
    defaultDiscountType: value.defaultDiscountType === 'percent' ? 'percent' : 'amount',
    defaultDiscountValue: Number.isFinite(value.defaultDiscountValue) ? value.defaultDiscountValue : 0,
    invoiceDueDays: integer(value.invoiceDueDays, 30, 0, 730),
    paymentScheduleEnabled: value.paymentScheduleEnabled === true,
    paymentMilestones: (Array.isArray(value.paymentMilestones) ? value.paymentMilestones : DEFAULTS.billingDefaults.paymentMilestones).map(plain),
  };
}
function automationDefaults(studio = {}) {
  const value = plain(studio.automation);
  return {
    autoCreateInvoice: value.autoCreateInvoice !== false,
    quoteRemindersEnabled: value.quoteRemindersEnabled === true,
    quoteReminderDays: value.quoteReminderDays || [3, 7, 14, 21, 30],
    invoiceRemindersEnabled: value.invoiceRemindersEnabled === true,
    invoiceReminderDays: value.invoiceReminderDays || [3, 7, 14],
  };
}
function clientLinkOptions(studio = {}, saved) {
  const source = plain(saved === undefined ? studio.clientLinkDefaults : saved);
  return {
    showCrew: source.showCrew !== false,
    showProgress: source.showProgress !== false,
    showDeliverables: source.showDeliverables !== false,
    showPayments: source.showPayments !== false,
    allowChat: source.allowChat !== false,
    linkExpiryDays: integer(source.linkExpiryDays, 0, 0, 3650),
  };
}
function linkIsActive(document, now = new Date()) {
  return !document.linkRevokedAt && (!document.linkExpiresAt || +new Date(document.linkExpiresAt) > +now);
}
function quoteDefaults(studio = {}, now = new Date()) {
  const billing = billingDefaults(studio), automation = automationDefaults(studio);
  const issueDate = studioDay(studio, now);
  return {
    issueDate,
    validUntil: addDays(issueDate, integer(studio.quotationValidityDays, 14, 0, 365)),
    discountType: billing.defaultDiscountType,
    discountValue: billing.defaultDiscountValue,
    taxRateBps: Math.round(billing.defaultTaxPercent * 100),
    terms: studio.quotationTerms || '',
    notes: studio.defaultDeliverables || '',
    autoCreateInvoice: automation.autoCreateInvoice,
    remindersEnabled: automation.quoteRemindersEnabled,
    reminderDays: automation.quoteReminderDays,
    design: { coverImage: studio.coverImage || '/assets/banner.jpg', colorTheme: studio.colorTheme || '#202622', fontTheme: studio.fontTheme || 'modern' },
  };
}
function invoiceDefaults(studio = {}, now = new Date()) {
  const billing = billingDefaults(studio), automation = automationDefaults(studio);
  const invoiceDate = studioDay(studio, now);
  return {
    invoiceDate, dueDate: addDays(invoiceDate, billing.invoiceDueDays),
    discountType: billing.defaultDiscountType === 'percent' ? 'percent' : 'fixed',
    discountValue: billing.defaultDiscountValue,
    taxRateBps: Math.round(billing.defaultTaxPercent * 100),
    terms: studio.quotationTerms || '',
    paymentScheduleEnabled: billing.paymentScheduleEnabled,
    paymentReminders: automation.invoiceRemindersEnabled,
    reminderOffsets: automation.invoiceReminderDays,
    design: { coverUrl: studio.coverImage || '/assets/studio-wedding.webp', accentColor: studio.colorTheme || '#202622', fontFamily: studio.fontTheme || 'modern', showLogo: true },
  };
}
function paymentSchedule(totalPaise, invoiceDate, dueDate, milestones = []) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || milestones.length < 2) return [];
  const start = dateOnly(invoiceDate), end = dateOnly(dueDate);
  const duration = Math.round((Date.parse(end) - Date.parse(start)) / DAY);
  if (duration < 1) return [];
  const sum = milestones.reduce((total, milestone) => total + Math.round(Number(milestone.percent) * 100), 0);
  if (sum !== 10000 || milestones.some(m => !Number.isFinite(m.percent) || m.percent <= 0 || !Number.isInteger(m.offsetDays) || m.offsetDays < 0)) return [];
  let allocated = 0, previous = start;
  return milestones.map((milestone, index) => {
    const final = index === milestones.length - 1;
    const amountPaise = final ? totalPaise - allocated : Math.floor(totalPaise * Math.round(milestone.percent * 100) / 10000);
    allocated += amountPaise;
    const due = final ? end : addDays(start, Math.min(milestone.offsetDays, duration - 1));
    const date = due < previous ? previous : due;
    previous = date;
    return { label: String(milestone.label || `Payment ${index + 1}`).slice(0, 120), amountPaise, dueDate: date };
  });
}
function invoiceWithDefaults(body, studio, validate) {
  const input = { ...invoiceDefaults(studio, body.invoiceDate || new Date()), ...body };
  const enabled = input.paymentScheduleEnabled;
  if (enabled && !input.paymentSchedule?.length) {
    const calculated = validate({ ...input, paymentScheduleEnabled: false });
    input.paymentSchedule = paymentSchedule(Math.round(calculated.total * 100), calculated.invoiceDate, calculated.dueDate, billingDefaults(studio).paymentMilestones);
    if (!input.paymentSchedule.length) throw Object.assign(new Error('Configure at least two payment milestones totalling 100%, or turn off the default payment schedule.'), { status: 400 });
  }
  return validate(input);
}
function communicationValues(studio, kind, document = {}) {
  const value = plain(studio?.communication), brand = studio?.studioName || 'Team Alpha';
  const fields = { clientName: document.clientName || '', studioName: brand, documentNumber: document.documentNumber || '', dueDate: document.dueDate ? dateOnly(document.dueDate) : '' };
  const substitute = text => String(text).replace(/\{\{(clientName|studioName|documentNumber|dueDate)\}\}/g, (_, key) => fields[key]);
  const quote = kind === 'quote';
  return {
    subject: substitute(value[quote ? 'quoteSubject' : 'invoiceSubject'] || (quote ? 'Your quotation from {{studioName}}' : 'Invoice {{documentNumber}} from {{studioName}}')),
    message: substitute(value[quote ? 'quoteMessage' : 'invoiceMessage'] || (quote ? 'Hi {{clientName}},\n\nPlease review your quotation using the link below.\n\nThank you,\n{{studioName}}' : 'Hi {{clientName}},\n\nPlease review your invoice and payment schedule using the link below.\n\nThank you,\n{{studioName}}')),
  };
}
module.exports = { dateOnly, addDays, billingDefaults, automationDefaults, clientLinkOptions, linkIsActive, quoteDefaults, invoiceDefaults, paymentSchedule, invoiceWithDefaults, communicationValues };
