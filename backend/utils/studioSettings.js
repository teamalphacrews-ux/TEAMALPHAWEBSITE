const DEFAULTS = {
  billingDefaults: {
    quotationPrefix: 'TA-Q', invoicePrefix: 'TA-INV', numberingMode: 'reference', includeFinancialYear: false,
    defaultTaxPercent: 0, defaultDiscountType: 'amount', defaultDiscountValue: 0, invoiceDueDays: 30,
    paymentScheduleEnabled: false,
    paymentMilestones: [{ label: 'Booking', percent: 30, offsetDays: 0 }, { label: 'Before the event', percent: 40, offsetDays: 14 }, { label: 'Final delivery', percent: 30, offsetDays: 30 }],
  },
  automation: {
    autoCreateInvoice: true, invoiceApprovalRequired: true,
    quoteRemindersEnabled: false, quoteReminderDays: [3, 7, 14, 21, 30],
    invoiceRemindersEnabled: false, invoiceReminderDays: [3, 7, 14],
    notifyQuoteAccepted: true, notifyPaymentOverdue: true, notifyAssignments: true, notifyDeliveryDue: true,
    dailyDigestEnabled: false, dailyDigestHour: 9,
  },
  communication: { senderName: 'Team Alpha', replyTo: '', quoteSubject: '', quoteMessage: '', invoiceSubject: '', invoiceMessage: '', supportHours: '' },
  productionDefaults: { defaultTemplateId: '', templates: [] },
  clientLinkDefaults: { showCrew: true, showProgress: true, showDeliverables: true, showPayments: true, allowChat: true, linkExpiryDays: 0 },
  security: { idleTimeoutMinutes: 60, absoluteSessionHours: 24, permissions: { discounts: 'all_admins', deletion: 'all_admins', exports: 'all_admins', invoiceIssue: 'all_admins' } },
  backups: { enabled: false, frequency: 'daily', retentionDays: 30 },
};
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid ' + name); return value; }
function text(value, name, max = 2000) {
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Invalid ' + name);
  return value.trim();
}
function number(value, name, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) fail('Invalid ' + name);
  return value;
}
function bool(value, name) { if (typeof value !== 'boolean') fail('Invalid ' + name); return value; }
function choice(value, name, values) { if (!values.includes(value)) fail('Invalid ' + name); return value; }
function email(value, name) { const result = text(value, name, 254).toLowerCase(); if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid ' + name); return result; }
function image(value, name) {
  const result = text(value, name, 2000);
  if (!result || (/^\/assets\/[\w./-]+$/.test(result) && !result.includes('..')) || /^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(result)) return result;
  return https(result, name);
}
function https(value, name, domains) {
  const result = text(value, name, 2000); if (!result) return result;
  try { const url = new URL(result); if (url.protocol !== 'https:' || url.username || url.password || (domains && !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)))) throw Error(); return url.href; }
  catch { fail('Use a valid HTTPS ' + name + (domains ? ' on ' + domains.join(' or ') : '')); }
}
function days(value, name) {
  if (!Array.isArray(value) || !value.length || value.length > 12) fail('Choose 1 to 12 ' + name);
  return [...new Set(value.map(item => number(item, name, 1, 365, true)))].sort((a, b) => a - b);
}
function defaultsFor(key, supplied) { return { ...clone(DEFAULTS[key]), ...object(supplied, key) }; }
function parseAdvancedSettings(body) {
  object(body, 'settings'); const out = {};
  for (const [key, max] of [['legalName', 200], ['whatsappMessage', 1000]]) if (body[key] !== undefined) out[key] = text(body[key], key, max);
  if (body.gstin !== undefined) { const gstin = text(body.gstin, 'GSTIN', 15).toUpperCase(); if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) fail('GSTIN must contain a valid 15-character format'); out.gstin = gstin; }
  for (const key of ['profilePhotoUrl', 'logoUrl']) if (body[key] !== undefined) out[key] = image(body[key], key);
  if (body.whatsappNumber !== undefined) { const phone = text(body.whatsappNumber, 'WhatsApp number', 30); const normalized = phone.replace(/[\s()+-]/g, ''); if (normalized && !/^[1-9]\d{6,14}$/.test(normalized)) fail('Use a WhatsApp number with country code, for example +919876543210'); out.whatsappNumber = normalized; }
  for (const [key, domains] of [['instagramUrl', ['instagram.com']], ['facebookUrl', ['facebook.com', 'fb.com']]]) if (body[key] !== undefined) out[key] = https(body[key], key, domains);
  if (body.billingDefaults !== undefined) {
    const b = defaultsFor('billingDefaults', body.billingDefaults);
    const prefix = key => { const result = text(b[key], key, 16).toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(result)) fail('Document prefixes may contain letters, numbers, hyphens and underscores'); return result; };
    if (!Array.isArray(b.paymentMilestones) || !b.paymentMilestones.length || b.paymentMilestones.length > 8) fail('Add 1 to 8 payment milestones');
    const milestones = b.paymentMilestones.map(row => { object(row, 'payment milestone'); const label = text(row.label, 'milestone label', 100); if (!label) fail('Each payment milestone needs a name'); return { label, percent: number(row.percent, 'payment percentage', .01, 100), offsetDays: number(row.offsetDays, 'payment due days', 0, 730, true) }; });
    if (Math.abs(milestones.reduce((sum, row) => sum + row.percent, 0) - 100) > .0001) fail('Payment milestone percentages must total 100%');
    for (let i = 1; i < milestones.length; i++) if (milestones[i].offsetDays < milestones[i - 1].offsetDays) fail('Payment milestone due days must be in order');
    const discountType = choice(b.defaultDiscountType, 'discount type', ['amount', 'percent']);
    for (const value of [b.defaultTaxPercent, b.defaultDiscountValue, ...milestones.map(row => row.percent)]) if (typeof value === 'number' && Math.abs(value * 100 - Math.round(value * 100)) > .0001) fail('Use up to two decimal places for tax, discounts and percentages');
    if (b.paymentScheduleEnabled && (milestones.length < 2 || b.invoiceDueDays < 1)) fail('A payment schedule needs at least two milestones and an invoice due date after issue');
    if (b.paymentScheduleEnabled && milestones.some(row => row.offsetDays > b.invoiceDueDays)) fail('Payment milestones cannot be later than the default invoice due date');
    out.billingDefaults = { quotationPrefix: prefix('quotationPrefix'), invoicePrefix: prefix('invoicePrefix'), numberingMode: choice(b.numberingMode, 'numbering mode', ['reference', 'sequence']), includeFinancialYear: bool(b.includeFinancialYear, 'financial-year reference'), defaultTaxPercent: number(b.defaultTaxPercent, 'default tax', 0, 100), defaultDiscountType: discountType, defaultDiscountValue: number(b.defaultDiscountValue, 'default discount', 0, discountType === 'percent' ? 100 : 1e8), invoiceDueDays: number(b.invoiceDueDays, 'invoice due days', 0, 730, true), paymentScheduleEnabled: bool(b.paymentScheduleEnabled, 'payment schedule'), paymentMilestones: milestones };
  }
  if (body.automation !== undefined) {
    const a = defaultsFor('automation', body.automation); const parsed = {};
    for (const key of ['autoCreateInvoice', 'quoteRemindersEnabled', 'invoiceRemindersEnabled', 'notifyQuoteAccepted', 'notifyPaymentOverdue', 'notifyAssignments', 'notifyDeliveryDue', 'dailyDigestEnabled']) parsed[key] = bool(a[key], key);
    if (a.invoiceApprovalRequired !== true) fail('Automatically generated invoices require studio approval before issue');
    out.automation = { ...parsed, invoiceApprovalRequired: true, quoteReminderDays: days(a.quoteReminderDays, 'quotation reminder days'), invoiceReminderDays: days(a.invoiceReminderDays, 'invoice reminder days'), dailyDigestHour: number(a.dailyDigestHour, 'daily digest hour', 0, 23, true) };
  }
  if (body.communication !== undefined) {
    const c = defaultsFor('communication', body.communication); const parsed = {};
    for (const key of ['senderName', 'quoteSubject', 'invoiceSubject']) { parsed[key] = text(c[key], key, 200); if (/[\r\n]/.test(parsed[key])) fail('Email names and subjects must be on one line'); }
    for (const key of ['quoteMessage', 'invoiceMessage']) parsed[key] = text(c[key], key, 6000);
    out.communication = { ...parsed, replyTo: email(c.replyTo, 'reply-to email'), supportHours: text(c.supportHours, 'support hours', 500) };
  }
  if (body.productionDefaults !== undefined) {
    const p = defaultsFor('productionDefaults', body.productionDefaults);
    if (!Array.isArray(p.templates) || p.templates.length > 20) fail('Save up to 20 production templates');
    const ids = new Set();
    const templates = p.templates.map(template => {
      object(template, 'production template'); const id = text(template.id, 'template ID', 80); const name = text(template.name, 'template name', 120);
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id) || !name) fail('Production templates need unique IDs and a name'); ids.add(id);
      if (!Array.isArray(template.stages) || !template.stages.length || template.stages.length > 30) fail('Each production template needs 1 to 30 stages');
      return { id, name, stages: template.stages.map(stage => { object(stage, 'production stage'); const title = text(stage.title, 'stage title', 200); if (!title) fail('Each stage needs a title'); return { title, category: choice(stage.category, 'delivery category', ['Photos', 'Album', 'Traditional video', 'Cinematic video', 'Other']), dueDays: number(stage.dueDays, 'delivery target days', 0, 730, true), clientVisible: bool(stage.clientVisible, 'client visibility') }; }) };
    });
    const defaultTemplateId = text(p.defaultTemplateId, 'default production template', 80); if (defaultTemplateId && !ids.has(defaultTemplateId)) fail('Choose a saved default production template');
    out.productionDefaults = { defaultTemplateId, templates };
  }
  if (body.clientLinkDefaults !== undefined) {
    const c = defaultsFor('clientLinkDefaults', body.clientLinkDefaults); const parsed = {};
    for (const key of ['showCrew', 'showProgress', 'showDeliverables', 'showPayments', 'allowChat']) parsed[key] = bool(c[key], key);
    out.clientLinkDefaults = { ...parsed, linkExpiryDays: number(c.linkExpiryDays, 'client link validity', 0, 3650, true) };
  }
  if (body.security !== undefined) {
    const s = defaultsFor('security', body.security); const permissions = { ...DEFAULTS.security.permissions, ...object(s.permissions, 'permissions') };
    out.security = { idleTimeoutMinutes: number(s.idleTimeoutMinutes, 'idle timeout', 5, 1440, true), absoluteSessionHours: number(s.absoluteSessionHours, 'session lifetime', 1, 168, true), permissions: Object.fromEntries(Object.keys(DEFAULTS.security.permissions).map(key => [key, choice(permissions[key], key + ' permission', ['all_admins', 'owner_only'])])) };
  }
  if (body.backups !== undefined) { const b = defaultsFor('backups', body.backups); out.backups = { enabled: bool(b.enabled, 'scheduled backups'), frequency: choice(b.frequency, 'backup frequency', ['daily', 'weekly']), retentionDays: number(b.retentionDays, 'backup retention days', 1, 365, true) }; }
  return out;
}
module.exports = { DEFAULTS, parseAdvancedSettings, clone };
