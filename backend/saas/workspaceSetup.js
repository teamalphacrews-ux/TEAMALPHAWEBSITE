const mongoose = require('mongoose');
const { Workspace } = require('./models');
const StudioConfig = require('../models/StudioConfig');
const { workspaceView } = require('./service');
const { failure } = require('./access');
const { requiresSetup } = require('./setupAccess');
const { accessStatus } = require('./plans');
const { text, email, url } = require('../utils/studioRecords');
const { documentPrefix, parseAdvancedSettings } = require('../utils/studioSettings');

const fields = [
  ['studioName', 'legalName', 'website', 'logoUrl'],
  ['email', 'phone', 'address', 'whatsappNumber', 'instagramUrl', 'facebookUrl'],
  ['quotationPrefix', 'invoicePrefix', 'quotationValidityDays', 'invoiceDueDays', 'gstin'],
];
function days(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw failure(400, 'Enter a whole number from ' + min + ' to ' + max + '.');
  return value;
}
const validators = {
  studioName: value => {
    const name = text(value, 'studio name', 120, true);
    if (/[\r\n\t]/.test(name)) throw failure(400, 'Enter your studio name on one line.');
    return name;
  },
  legalName: value => parseAdvancedSettings({ legalName: value }).legalName,
  website: url,
  logoUrl: value => parseAdvancedSettings({ logoUrl: value }).logoUrl,
  email: value => email(value, true),
  phone: value => text(value, 'phone', 40),
  address: value => text(value, 'address', 1000),
  whatsappNumber: value => parseAdvancedSettings({ whatsappNumber: value }).whatsappNumber,
  instagramUrl: value => parseAdvancedSettings({ instagramUrl: value }).instagramUrl,
  facebookUrl: value => parseAdvancedSettings({ facebookUrl: value }).facebookUrl,
  quotationPrefix: value => documentPrefix(value, 'quotation prefix'),
  invoicePrefix: value => documentPrefix(value, 'invoice prefix'),
  quotationValidityDays: value => days(value, 1, 365),
  invoiceDueDays: value => days(value, 0, 730),
  gstin: value => parseAdvancedSettings({ gstin: value }).gstin,
};
function detailsOf(profile) {
  const details = {};
  for (const key of fields.flat()) details[key] = profile[key] ?? '';
  const billing = profile.billingDefaults || {};
  details.quotationPrefix = billing.quotationPrefix;
  details.invoicePrefix = billing.invoicePrefix || profile.invoicePrefix;
  details.invoiceDueDays = billing.invoiceDueDays;
  return details;
}
function validateStep(step, input, existing) {
  if (!Number.isInteger(step) || step < 1 || step > fields.length) throw failure(400, 'Choose a valid setup step.');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields[step - 1].includes(key)))
    throw failure(400, 'Only the fields for this setup step can be saved.');
  const errors = {}, values = {};
  for (const key of fields[step - 1]) {
    try { values[key] = validators[key](Object.hasOwn(input, key) ? input[key] : existing[key]); }
    catch (error) { if (error.status !== 400) throw error; errors[key] = error.message; }
  }
  if (Object.keys(errors).length) throw Object.assign(failure(400, Object.values(errors)[0]), { fieldErrors: errors });
  return values;
}
function profileUpdates(values) {
  const updates = { ...values };
  if (values.studioName !== undefined) updates['communication.senderName'] = values.studioName;
  if (values.email !== undefined) updates['communication.replyTo'] = values.email;
  for (const key of ['quotationPrefix', 'invoicePrefix', 'invoiceDueDays']) {
    if (values[key] !== undefined) {
      updates['billingDefaults.' + key] = values[key];
      if (key !== 'invoicePrefix') delete updates[key];
    }
  }
  return updates;
}
function canManage(workspace, membership, account) {
  return membership.role === 'owner' && String(workspace.ownerAccountId) === String(account._id);
}
function setupView(workspace, membership, account, profile) {
  const owner = canManage(workspace, membership, account);
  const reviewActive = owner && !requiresSetup(workspace) && workspace.setupReviewStep != null;
  const step = workspace.setupStep ?? (reviewActive ? workspace.setupReviewStep : 3);
  return { workspace: workspaceView(workspace, membership), canManage: owner, reviewActive,
    revision: owner ? workspace.setupRevision || 0 : 0, step: Math.min(step, 3), details: owner && profile ? detailsOf(profile) : {} };
}
async function getSetup({ workspace, membership, account }) {
  const profile = canManage(workspace, membership, account) ? await StudioConfig.findOne({ key: 'studio' }) : null;
  if ((requiresSetup(workspace) || workspace.setupReviewStep != null) && canManage(workspace, membership, account) && !profile) throw failure(503, 'Your studio profile is unavailable. Please retry.');
  return setupView(workspace, membership, account, profile);
}
function assertReviewWritable(workspace) {
  if (!requiresSetup(workspace) && !['active', 'trialing'].includes(accessStatus(workspace)))
    throw failure(402, 'Your studio is read-only. Renew its subscription before updating studio details.');
}
async function changeSetup({ workspace, membership, account }, action) {
  if (!canManage(workspace, membership, account)) throw failure(403, 'Only the studio owner can change setup.');
  return mongoose.connection.transaction(async session => {
    const current = await Workspace.findOne({ _id: workspace._id, state: 'active', ownerAccountId: account._id }).session(session);
    if (!current) throw failure(403, 'Your studio is unavailable.');
    const profile = await StudioConfig.findOne({ key: 'studio' }).session(session);
    if (!profile) throw failure(503, 'Your studio profile is unavailable. Please retry.');
    await action(current, profile, session);
    return setupView(current, membership, account, profile);
  });
}
function restartSetup(identity, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw failure(400, 'Restart setup for the current studio only.');
  return changeSetup(identity, async (current, _profile, session) => {
    assertReviewWritable(current);
    if (requiresSetup(current)) current.setupStep = 1;
    else current.setupReviewStep = 1;
    current.setupRevision = (current.setupRevision || 0) + 1;
    await current.save({ session });
  });
}
function reviewUpdates(values, submitted, existing, profile) {
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) =>
    Object.hasOwn(submitted, key) && submitted[key] !== existing[key] && value !== existing[key]));
  const updates = profileUpdates(changed);
  // The sender identity and legacy prefix can be customized independently in
  // Settings. Re-reading an existing profile must not replace those settings.
  if (profile.communication?.senderName && profile.communication.senderName !== existing.studioName) delete updates['communication.senderName'];
  if (profile.communication?.replyTo && profile.communication.replyTo !== existing.email) delete updates['communication.replyTo'];
  if (profile.invoicePrefix && profile.invoicePrefix !== existing.invoicePrefix) delete updates.invoicePrefix;
  if (changed.invoiceDueDays !== undefined && profile.billingDefaults?.paymentScheduleEnabled) {
    const billing = profile.billingDefaults.toObject?.() || profile.billingDefaults;
    try { parseAdvancedSettings({ billingDefaults: { ...billing, invoiceDueDays: changed.invoiceDueDays } }); }
    catch (error) {
      if (error.status !== 400) throw error;
      throw Object.assign(error, { fieldErrors: { invoiceDueDays: error.message } });
    }
  }
  return updates;
}
// The registry progress and tenant Settings commit together. A new revision
// prevents a delayed request from an old browser window from finishing a restarted run.
async function saveSetup(identity, body, complete = false) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) throw failure(400, 'Send the studio setup details.');
  if (Object.keys(body).some(key => !(complete ? ['details', 'revision'] : ['step','details', 'revision']).includes(key))) throw failure(400, 'Unexpected studio setup field.');
  return changeSetup(identity, async (current, profile, session) => {
    if ((body.revision ?? 0) !== (current.setupRevision || 0)) throw failure(409, 'Studio setup was restarted. Reload the steps to continue.');
    const required = requiresSetup(current);
    const cursor = required ? current.setupStep : current.setupReviewStep;
    if (cursor == null) {
      if (complete) return;
      throw failure(409, 'Setup has finished. Open studio setup again to review these details.');
    }
    assertReviewWritable(current);
    const step = complete ? 3 : body.step;
    if (!Number.isInteger(step) || step < 1 || step > 3) throw failure(400, 'Choose a valid setup step.');
    if (step > cursor || (complete && cursor === 3 && body.details === undefined))
      throw failure(409, 'Save each setup step in order before finishing.');
    const existing = detailsOf(profile);
    const values = validateStep(step, complete && body.details === undefined ? {} : body.details, existing);
    if (complete) {
      for (const previous of [1, 2]) validateStep(previous, {}, existing);
    }
    const updates = required ? profileUpdates(values) : reviewUpdates(values, body.details || {}, existing, profile);
    if (Object.keys(updates).length) {
      profile.set(updates);
      await profile.save({ session });
    }
    if (updates.studioName !== undefined) current.name = updates.studioName;
    const marker = required ? 'setupStep' : 'setupReviewStep';
    if (complete) {
      current[marker] = undefined;
      if (required) current.setupCompletedAt = new Date();
    } else {
      current[marker] = Math.max(cursor, step + 1);
    }
    await current.save({ session });
  });
}
module.exports = { getSetup, saveSetup, restartSetup, validateStep, profileUpdates, detailsOf, setupView };
