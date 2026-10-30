const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const models = require('./models');
const { runInWorkspace, workspaceDatabase } = require('./tenantContext');
const { TRIAL_DAYS, plans } = require('./plans');
const { failure } = require('./access');
const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
function text(value, name, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw failure(400, `Enter a valid ${name}.`);
  return value.trim();
}
function credentials(body, { fresh = false } = {}) {
  const email = emailOf(body.email), password = body.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure(400, 'Enter a valid email address.');
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 72 || (fresh && password.length < 12)) throw failure(400, fresh ? 'Use a password of 12 characters or more, up to 72 bytes.' : 'Enter your Studio OS password.');
  return { email, password };
}
async function authenticateAccount(body, { create = false } = {}) {
  const { email, password } = credentials(body);
  let account = await models.Account.findOne({ email }).select('+passwordHash');
  if (account) {
    if (account.state !== 'active' || !await bcrypt.compare(password, account.passwordHash)) throw failure(401, 'Email or password is incorrect.');
    return account;
  }
  if (!create) { await bcrypt.hash(password, 12); throw failure(401, 'Email or password is incorrect.'); }
  credentials(body, { fresh: true });
  const firstName = text(body.firstName, 'first name'), lastName = text(body.lastName || ' ', 'last name');
  try { account = await models.Account.create({ email, firstName, lastName, passwordHash: await bcrypt.hash(password, 12) }); }
  catch (error) { if (error.code === 11000) throw failure(409, 'This account already exists. Sign in and create your studio from the workspace picker.'); throw error; }
  return account;
}
function workspaceView(workspace, membership) {
  return { id: String(workspace._id), name: workspace.name, slug: workspace.slug, role: membership?.role,
    planId: workspace.planId, subscriptionStatus: workspace.subscriptionStatus, status: workspace.subscriptionStatus,
    trialEndsAt: workspace.trialEndsAt, state: workspace.state };
}
async function localMember(workspace, account, role) {
  return runInWorkspace(workspace, async () => {
    const User = require('../models/User');
    let user = await User.findOne({ email: account.email });
    if (!user) user = await User.create({ firstName: account.firstName, lastName: account.lastName, email: account.email,
      // Account credentials are kept only in the global identity store, never in the password vault.
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), role: 'admin', studioOwner: role === 'owner' });
    return user;
  });
}
async function provisionWorkspace(account, name) {
  const id = new mongoose.Types.ObjectId(), plan = plans()[0];
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'studio';
  const workspace = await models.Workspace.create({ _id: id, name, slug: `${slugBase}-${String(id).slice(-8)}`,
    databaseName: workspaceDatabase(id), ownerAccountId: account._id, planId: plan.id, seatLimit: plan.seatLimit,
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000), state: 'provisioning' });
  try {
    await runInWorkspace(workspace, async () => {
      // Initialize tenant indexes before admitting members. Partial provisioning never opens access.
      const { ensureWorkspaceModels } = require('./tenantModels').installTenantModels();
      const connection = mongoose.connection.useDb(workspace.databaseName, { useCache: true });
      ensureWorkspaceModels(connection);
      await Promise.all(Object.values(connection.models).map(model => model.init()));
      await require('../models/StudioConfig').create({ key: 'studio', studioName: name, legalName: name,
        email: account.email, logoUrl: '/assets/studio-os-mark.svg', profilePhotoUrl: '', coverImage: '', invoicePrefix: 'INV',
        communication: { senderName: name, replyTo: account.email } });
    });
    const user = await localMember(workspace, account, 'owner');
    const membership = await models.Membership.create({ workspaceId: id, accountId: account._id, localUserId: user._id, role: 'owner' });
    workspace.state = 'active'; await workspace.save();
    return { workspace, membership };
  } catch (error) { workspace.state = 'failed'; await workspace.save().catch(() => {}); throw error; }
}
async function issueSession(account, workspace, membership, req) {
  if (workspace.state !== 'active' || membership.state !== 'active') throw failure(403, 'This studio is not available.');
  return runInWorkspace(workspace, async () => {
    const user = await require('../models/User').findById(membership.localUserId);
    if (!user) throw failure(403, 'Your team account is not available.');
    const sign = (payload, secret, options) => jwt.sign({ ...payload, accountId: String(account._id), workspaceId: String(workspace._id) }, secret, options);
    const token = await require('../services/studioSecurity').openSession(user, req, sign, process.env.JWT_SECRET);
    return { token, user: { id: String(user._id), accountId: String(account._id), firstName: user.firstName, lastName: user.lastName,
      email: account.email, role: 'admin', workspaceRole: membership.role, workspace: workspaceView(workspace, membership) } };
  });
}
async function expireInvitations(workspaceId) {
  const interrupted = await models.Invitation.find({ workspaceId, state: 'accepting', acceptingUntil: { $lte: new Date() } });
  for (const row of interrupted) {
    const account = await models.Account.findOne({ email: row.email });
    const joined = account && await models.Membership.exists({ workspaceId, accountId: account._id, state: 'active' });
    await models.Invitation.updateOne({ _id: row._id, state: 'accepting', acceptingUntil: { $lte: new Date() } }, { $set: { state: joined ? 'accepted' : 'pending' }, $unset: { acceptingUntil: 1 } });
  }
  const pending = await models.Invitation.find({ workspaceId, state: 'pending', expiresAt: { $lte: new Date() } }).select('_id');
  for (const row of pending) {
    const changed = await models.Invitation.updateOne({ _id: row._id, state: 'pending' }, { $set: { state: 'expired' } });
    if (changed.modifiedCount) await models.Workspace.updateOne({ _id: workspaceId, seatsReserved: { $gt: 0 } }, { $inc: { seatsReserved: -1 } });
  }
}
module.exports = { emailOf, text, credentials, authenticateAccount, workspaceView, localMember, provisionWorkspace, issueSession, expireInvitations };
