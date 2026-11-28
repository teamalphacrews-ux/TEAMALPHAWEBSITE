const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const models = require('./models');
const { currentWorkspace, workspaceDatabase } = require('./tenantContext');
const { requiresSetup } = require('./setupAccess');
const gate = require('../services/studioArchiveGate');
const State = require('../models/StudioArchiveState');
const StudioConfig = require('../models/StudioConfig');
const PushDevice = require('../models/StudioPushDevice');
const { defaultStudioProfile } = require('./service');

const CONFIRMATION = 'DELETE WORKSPACE DATA';
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const stale = () => fail(409, 'Studio data changed. Open Start fresh again.', 'WORKSPACE_RESET_STALE');
const needSignIn = 'Sign out and sign in again before starting fresh. Then return to Settings.';
const notReady = 'Finish studio setup before starting fresh again.';

function assertOwner(identity, actorId, sessionId) {
  const { workspace, account, membership } = identity || {};
  const scope = currentWorkspace();
  if (!scope || scope._id !== String(workspace?._id) || membership?.role !== 'owner' ||
      String(workspace?.ownerAccountId) !== String(account?._id) || String(membership.localUserId) !== actorId ||
      !sessionId || sessionId !== identity.decoded?.sid) {
    throw fail(403, 'Only the signed-in studio owner can start fresh.', 'WORKSPACE_RESET_OWNER_REQUIRED');
  }
}

function recentAuthentication(decoded, now = Date.now()) {
  const at = decoded?.accountAuthenticatedAt;
  return Number.isSafeInteger(at) && at <= now && now - at <= AUTH_WINDOW_MS;
}

function getStatus(identity, actorId, sessionId) {
  assertOwner(identity, actorId, sessionId);
  const { workspace, account, decoded } = identity;
  const requiresPassword = !account.oauthProvider;
  const msg = requiresSetup(workspace) ? notReady : !requiresPassword && !recentAuthentication(decoded) ? needSignIn : '';
  return { workspaceId: String(workspace._id), workspaceName: workspace.name, revision: workspace.resetRevision || 0,
    eligible: !msg, requiresPassword, ...(msg && { msg }) };
}

async function verifyConfirmation(body, account, decoded) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['revision', 'confirmation', 'password'].includes(key)) ||
      body.confirmation !== CONFIRMATION) {
    throw fail(400, 'Type ' + CONFIRMATION + ' exactly to confirm.', 'WORKSPACE_RESET_CONFIRMATION');
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw stale();
  if (account.oauthProvider) {
    if (!recentAuthentication(decoded)) throw fail(403, needSignIn, 'WORKSPACE_RESET_REAUTH_REQUIRED');
    return;
  }
  const password = body.password;
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 72 || !await bcrypt.compare(password, account.passwordHash)) {
    throw fail(401, 'The account password is incorrect.', 'WORKSPACE_RESET_PASSWORD_INVALID');
  }
}

async function replaceTenantRecords({ database, account, actorId, sessionId, session, revision, collections }) {
  const ownerId = new mongoose.Types.ObjectId(actorId);
  const activeSessionId = new mongoose.Types.ObjectId(sessionId);
  const users = database.collection('users'), sessions = database.collection('adminsessions');
  const ownerFilter = { _id: ownerId, role: 'admin', studioOwner: true, accountDisabled: { $ne: true } };
  const owner = await users.findOne(ownerFilter, { session });
  const activeSession = owner && await sessions.findOne({
    _id: activeSessionId, user: ownerId, revokedAt: null, expiresAt: { $gt: new Date() }, version: owner.sessionVersion || 0,
  }, { session });
  if (!activeSession) throw fail(401, 'Sign in again before starting fresh.', 'WORKSPACE_RESET_SESSION_REQUIRED');
  // Explicitly preserve just the local owner's login identity and its current session.
  const retainedOwner = { _id: ownerId, firstName: account.firstName, lastName: account.lastName || '', email: account.email,
    password: owner.password, role: 'admin', studioOwner: true, moduleAccess: null, accountDisabled: false,
    sessionVersion: owner.sessionVersion || 0, workspaceDataVersion: revision, createdAt: owner.createdAt, updatedAt: new Date() };
  await users.replaceOne(ownerFilter, retainedOwner, { session });
  await users.deleteMany({ _id: { $ne: ownerId } }, { session });
  await sessions.deleteMany({ _id: { $ne: activeSessionId } }, { session });

  // Enumerate the validated tenant database so old or newly added application
  // collections are covered, including recovery data and stored credentials.
  for (const { name } of collections) {
    if (name.startsWith('system.') || name === 'users' || name === 'adminsessions') continue;
    await database.collection(name).deleteMany({}, { session });
  }
}

async function resetWorkspace(identity, actorId, sessionId, body) {
  assertOwner(identity, actorId, sessionId);
  const { workspace, membership, account, decoded } = identity;
  const workspaceId = workspace._id, revision = workspace.resetRevision || 0;
  const accountFilter = { _id: account._id, state: 'active' };
  const verified = await models.Account.findOne(accountFilter).select('+passwordHash');
  if (!verified) throw fail(401, 'Sign in again before starting fresh.', 'WORKSPACE_RESET_SESSION_REQUIRED');
  await verifyConfirmation(body, verified, decoded);
  if (body.revision !== revision) throw stale();
  if (requiresSetup(workspace)) throw fail(409, notReady, 'WORKSPACE_RESET_SETUP_REQUIRED');

  const database = mongoose.connection.getClient().db(workspaceDatabase(workspaceId));
  // MongoDB does not support listCollections in a transaction. The exclusive
  // lease keeps application producers out while taking the collection inventory.
  return gate.withExclusive(async lease => {
    const collections = await database.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
    return mongoose.connection.transaction(async session => {
      await gate.assertExclusive(session);
      const target = { _id: workspaceId, state: 'active', ownerAccountId: account._id, setupStep: null,
        ...(revision ? { resetRevision: revision } : { $or: [{ resetRevision: 0 }, { resetRevision: { $exists: false } }] }) };
      const updated = await models.Workspace.updateOne(target, {
        $set: { setupStep: 1, resetRevision: revision + 1, seatsReserved: 1 },
        $inc: { setupRevision: 1 },
        $unset: { setupCompletedAt: 1, setupReviewStep: 1 },
      }, { session, runValidators: true });
      if (updated.matchedCount !== 1) throw stale();
      const activeAccount = await models.Account.exists({ ...accountFilter, passwordHash: verified.passwordHash }).session(session);
      const activeOwner = await models.Membership.exists({ _id: membership._id, workspaceId, accountId: account._id,
        localUserId: actorId, role: 'owner', state: 'active' }).session(session);
      if (!activeAccount || !activeOwner) throw fail(403, 'The studio owner has changed. Sign in again.', 'WORKSPACE_RESET_OWNER_REQUIRED');
      await replaceTenantRecords({ database, account: verified, actorId, sessionId, session, revision: revision + 1, collections });
      await StudioConfig.create([defaultStudioProfile(workspace.name, verified.email)], { session, ordered: true });
      await models.Invitation.deleteMany({ workspaceId }, { session });
      await models.Membership.deleteMany({ workspaceId, _id: { $ne: membership._id } }, { session });
      await models.CalendarBinding.deleteMany({ workspaceId }, { session });
      await PushDevice.deleteMany({ workspaceKey: String(workspaceId) }, { session });

      await gate.assertExclusive(session);
      const versioned = await State.updateOne({
        _id: lease.key, maintenanceToken: lease.token, maintenanceUntil: { $gt: new Date() }, dataVersion: revision,
      }, { $set: { dataVersion: revision + 1 } }, { session });
      if (versioned.matchedCount !== 1) throw stale();
      return { success: true, setupRequired: true };
    });
  });
}

module.exports = { getStatus, resetWorkspace };
