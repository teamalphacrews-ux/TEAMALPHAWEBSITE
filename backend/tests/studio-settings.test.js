const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, parseAdvancedSettings, clone } = require('../utils/studioSettings');
const { buildTemplateTasks, applyProductionTemplate } = require('../services/productionTemplates');

test('frontend and backend settings defaults stay aligned', () => {
  assert.deepEqual(require('../../frontend/src/admin/studio-settings-defaults.json'), DEFAULTS);
});
test('studio profile validates GSTIN, social domains, WhatsApp and safe image references', () => {
  const values = parseAdvancedSettings({ legalName: 'Team Alpha', gstin: '29abcde1234f1z5', whatsappNumber: '+91 (98765) 43210', instagramUrl: 'https://www.instagram.com/teamalpha', facebookUrl: 'https://facebook.com/teamalpha', profilePhotoUrl: '/api/studio/profile-images/607f1f77bcf86cd799439011' });
  assert.equal(values.gstin, '29ABCDE1234F1Z5'); assert.equal(values.whatsappNumber, '919876543210');
  for (const body of [{ gstin: '1234' }, { whatsappNumber: '0123' }, { instagramUrl: 'https://instagram.com.attacker.test/x' }, { facebookUrl: 'javascript:alert(1)' }, { logoUrl: 'https://user:secret@example.test/pic.png' }, { profilePhotoUrl: '/api/studio/profile-images/../settings' }]) assert.throws(() => parseAdvancedSettings(body), error => error.status === 400);
});
test('payment defaults reject under-allocation, excessive precision and impossible deadlines', () => {
  const valid = clone(DEFAULTS.billingDefaults); valid.paymentScheduleEnabled = true;
  assert.equal(parseAdvancedSettings({ billingDefaults: valid }).billingDefaults.paymentMilestones.length, 3);
  for (const patch of [{ paymentMilestones: [{ label: 'Booking', percent: 99, offsetDays: 0 }] }, { defaultDiscountType: 'percent', defaultDiscountValue: 101 }, { defaultTaxPercent: 18.001 }, { invoiceDueDays: 7 }, { quotationPrefix: '../TA' }, { paymentMilestones: [{ label: 'Only payment', percent: 100, offsetDays: 0 }] }]) assert.throws(() => parseAdvancedSettings({ billingDefaults: { ...valid, ...patch } }), error => error.status === 400);
});
test('approval cannot be disabled and reminder days and email headers are bounded', () => {
  assert.throws(() => parseAdvancedSettings({ automation: { ...DEFAULTS.automation, invoiceApprovalRequired: false } }));
  assert.deepEqual(parseAdvancedSettings({ automation: { ...DEFAULTS.automation, quoteReminderDays: [14, 3, 3] } }).automation.quoteReminderDays, [3, 14]);
  for (const body of [{ automation: { ...DEFAULTS.automation, invoiceReminderDays: [0, 367] } }, { communication: { ...DEFAULTS.communication, senderName: 'Studio\r\nBCC: victim@example.test' } }, { communication: { ...DEFAULTS.communication, replyTo: 'bad' } }, { security: { ...DEFAULTS.security, idleTimeoutMinutes: 0 } }, { security: { ...DEFAULTS.security, permissions: { discounts: 'anyone' } } }, { backups: { enabled: 'true', frequency: 'daily', retentionDays: 30 } }]) assert.throws(() => parseAdvancedSettings(body), error => error.status === 400);
});
test('production templates reject missing defaults, duplicate identities and unsafe visibility types', () => {
  const template = { id: 'wedding', name: 'Wedding', stages: [{ title: 'Album', category: 'Album', dueDays: 30, clientVisible: false }] };
  const valid = { defaultTemplateId: template.id, templates: [template] };
  assert.equal(parseAdvancedSettings({ productionDefaults: valid }).productionDefaults.templates[0].stages[0].clientVisible, false);
  for (const value of [{ ...valid, defaultTemplateId: 'missing' }, { ...valid, templates: [template, template] }, { ...valid, templates: [{ ...template, stages: [{ ...template.stages[0], clientVisible: 'true' }] }] }]) assert.throws(() => parseAdvancedSettings({ productionDefaults: value }));
});
test('production task target dates use the Indian event date and preserve private checklist stages', () => {
  const tasks = buildTemplateTasks({ id: 'wedding', stages: [{ title: 'Internal backup', category: 'Other', dueDays: 0, clientVisible: false }, { title: 'Edited photos', category: 'Photos', dueDays: 30, clientVisible: true }] }, { _id: 'lead', eventDate: '2026-10-31T20:00:00Z' });
  assert.equal(tasks[0].dueDate.toISOString(), '2026-11-01T18:29:59.999Z');
  assert.equal(tasks[1].dueDate.toISOString(), '2026-12-01T18:29:59.999Z');
  assert.equal(tasks[0].clientTitle, ''); assert.equal(tasks[1].clientTitle, 'Edited photos');
});
test('reapplying a template keeps existing task progress and repairs enquiry references without duplicates', async () => {
  const store = new Map(), ids = new Set(); let serial = 0;
  const lead = { _id: '607f1f77bcf86cd799439011', eventDate: '2026-10-01' };
  const Task = { findOneAndUpdate: async (filter, update) => { if (!store.has(filter.templateKey)) store.set(filter.templateKey, { _id: String(++serial), ...update.$setOnInsert }); return store.get(filter.templateKey); } };
  const Lead = { findById: async () => lead, updateOne: async (_, update) => update.$addToSet.tasks.$each.forEach(id => ids.add(id)) };
  const Config = { findOne: async () => ({ productionDefaults: { defaultTemplateId: 'wedding', templates: [{ id: 'wedding', name: 'Wedding', stages: [{ title: 'Photos', category: 'Photos', dueDays: 30, clientVisible: true }] }] } }) };
  await applyProductionTemplate(lead._id, '', { Task, Lead, Config });
  store.get('wedding:0').status = 'completed'; ids.clear();
  await applyProductionTemplate(lead._id, 'wedding', { Task, Lead, Config });
  assert.equal(store.size, 1); assert.equal(store.get('wedding:0').status, 'completed'); assert.equal(ids.size, 1);
});
