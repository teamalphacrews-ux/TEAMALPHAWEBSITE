const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { currentWorkspace, runInWorkspace } = require('./tenantContext');
const { accessStatus } = require('./plans');

const workspaceToken = /^cal\.([a-f0-9]{24})\.([a-f0-9]{64})$/;
const unavailable = () => Object.assign(new Error('This studio calendar connection is unavailable.'), { status: 403 });

function calendarToken(nonce) {
  const workspace = currentWorkspace();
  return workspace ? 'cal.' + workspace._id + '.' + nonce : nonce;
}

function scopedCalendarReturn(handler, parameter, models = require('./models')) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const input = req.query?.[parameter];
    const match = typeof input === 'string' && workspaceToken.exec(input);
    try {
      if (!match) throw unavailable();
      const workspace = await models.Workspace.findOne({ _id: match[1], state: 'active' });
      if (!workspace || String(workspace._id) !== match[1] || !['active', 'trialing'].includes(accessStatus(workspace))) throw unavailable();
      return await runInWorkspace(workspace, () => handler(req, res, match[2]));
    } catch {
      return res.status(403).send('This calendar connection has expired. Return to your Studio X OS calendar and connect again.');
    }
  };
}

async function activeCalendarOwner(workspace, localUserId, models = require('./models')) {
  if (!workspace || !['active', 'trialing'].includes(accessStatus(workspace))) return false;
  const [member, account] = await Promise.all([
    models.Membership.exists({ workspaceId: workspace._id, accountId: workspace.ownerAccountId, localUserId, role: 'owner', state: 'active' }),
    models.Account.exists({ _id: workspace.ownerAccountId, state: 'active' }),
  ]);
  return Boolean(member && account);
}

const idleCalendar = () => ({ $or: [{ googleSyncLeaseUntil: null }, { googleSyncLeaseUntil: { $lte: new Date() } }] });
const bindingError = code => Object.assign(new Error('The studio calendar connection changed.'), { code, status: 409 });

async function attachCalendar(User, accountFilter, update, sourceId, models = require('./models'), transaction = fn => mongoose.connection.transaction(fn)) {
  const workspaceId = currentWorkspace()._id;
  const source = crypto.createHash('sha256').update(sourceId).digest('hex');
  const googleConnectionId = crypto.randomUUID();
  try {
    return await transaction(async session => {
      await models.CalendarBinding.updateOne({ _id: source, workspaceId }, { $setOnInsert: { workspaceId } }, { upsert: true, session });
      const user = await User.findOneAndUpdate({
        ...accountFilter,
        ...(!update.googleRefreshToken ? { googleCalendarSource: source } : {}),
        $and: [idleCalendar(), { $or: [{ googleCalendarSource: null }, { googleCalendarSource: source }] }],
      }, { $set: { ...update, googleCalendarSource: source, googleConnectionId, googleSyncRevision: 0 } }, { new: true, projection: '+googleAccessToken +googleRefreshToken', session });
      if (!user) throw bindingError('calendar_changed');
      return user;
    });
  } catch (error) {
    if (error.code === 11000) throw bindingError('calendar_in_use');
    throw error;
  }
}

async function detachCalendar(User, userId, unset) {
  return mongoose.connection.transaction(async session => {
    const user = await User.findOneAndUpdate({ _id: userId, studioOwner: true, ...idleCalendar() }, {
      $unset: { ...unset, googleConnectionId: 1, googleCalendarSource: 1, googleSyncRevision: 1, googleSyncLease: 1, googleSyncLeaseUntil: 1 },
    }, { session });
    if (!user) throw bindingError('calendar_busy');
    if (user.googleCalendarSource)
      await require('./models').CalendarBinding.deleteOne({ _id: user.googleCalendarSource, workspaceId: currentWorkspace()._id }, { session });
  });
}

// Hold a short database lease only while applying imported changes or making
// provider writes. A disconnect cannot succeed in the middle of either operation.
function calendarGeneration(user) {
  return { _id: user._id, googleConnectionId: user.googleConnectionId, googleCalendarSource: user.googleCalendarSource, accountDisabled: { $ne: true } };
}

function snapshotFilter(user) {
  return { ...calendarGeneration(user), ...idleCalendar(), googleSyncRevision: user.googleSyncRevision };
}

async function withCalendarLease(user, work, snapshot = false) {
  const User = require('../models/User');
  if (!currentWorkspace()) return work(async () => {});
  if (!user.googleConnectionId || !user.googleCalendarSource) throw bindingError('calendar_changed');
  const filter = calendarGeneration(user);
  const lease = crypto.randomUUID();
  const leaseUntil = () => new Date(Date.now() + 90000);
  // Reading Google happens outside the lease. Its snapshot is valid only
  // while the revision is unchanged. Every writer invalidates earlier reads.
  const claim = await User.updateOne(snapshot ? snapshotFilter(user) : { ...filter, ...idleCalendar() }, {
    $inc: { googleSyncRevision: 1 }, $set: { googleSyncLease: lease, googleSyncLeaseUntil: leaseUntil() },
  });
  if (!claim.matchedCount) throw bindingError('calendar_busy');
  let nextRenewal = Date.now() + 30000;
  const renew = async () => {
    if (Date.now() < nextRenewal) return;
    const result = await User.updateOne({ ...filter, googleSyncLease: lease }, { $set: { googleSyncLeaseUntil: leaseUntil() } });
    if (!result.matchedCount) throw bindingError('calendar_changed');
    nextRenewal = Date.now() + 30000;
  };
  try { return await work(renew); }
  finally { await User.updateOne({ ...filter, googleSyncLease: lease }, { $unset: { googleSyncLease: 1, googleSyncLeaseUntil: 1 } }); }
}

module.exports = { calendarToken, workspaceToken, scopedCalendarReturn, activeCalendarOwner, attachCalendar, detachCalendar, snapshotFilter, withCalendarLease };
