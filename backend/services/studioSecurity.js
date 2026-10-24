const crypto = require('node:crypto');
const { DEFAULTS } = require('../utils/studioSettings');
const fail = (message, status = 403) => Object.assign(new Error(message), { status });
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
async function securityConfig() {
  const config = await require('../models/StudioConfig').findOne({ key: 'studio' }).select('security').lean();
  return { ...DEFAULTS.security, ...config?.security, permissions: { ...DEFAULTS.security.permissions, ...config?.security?.permissions } };
}
async function isOwner(userId) {
  const user = await require('../models/User').findById(userId).select('role email studioOwner');
  return !!(user?.role === 'admin' && (user.studioOwner === true || (process.env.ADMIN_EMAIL && user.email?.trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase())));
}
async function assertOwner(userId) { if (!await isOwner(userId)) throw fail('Only the studio owner can change security, accounts or recovery settings.'); }
async function assertPermission(userId, action) {
  if (!Object.hasOwn(DEFAULTS.security.permissions, action)) throw fail('Unknown studio permission.');
  const user = await require('../models/User').findById(userId).select('role');
  if (user?.role !== 'admin') throw fail('Studio administrator access required.');
  const config = await module.exports.securityConfig();
  if (config.permissions[action] === 'owner_only') await assertOwner(userId);
}
function requirePermission(action) { return async (req, res, next) => { try { await assertPermission(req.user?.id, action); next(); } catch (e) { res.status(e.status || 503).json({ error: e.status ? e.message : 'Permission checks are temporarily unavailable.' }); } }; }
function sessionExpired(row, config, now = Date.now()) {
  if (![row.createdAt, row.lastSeenAt, row.expiresAt].every(value => value && Number.isFinite(new Date(value).getTime()))) return true;
  return !!row.revokedAt || !row.createdAt || !row.lastSeenAt || now >= new Date(row.expiresAt).getTime() || now - new Date(row.createdAt).getTime() >= config.absoluteSessionHours * 3600000 || now - new Date(row.lastSeenAt).getTime() >= config.idleTimeoutMinutes * 60000;
}
function createSessionVerifier({ Session = require('../models/AdminSession'), getConfig = () => module.exports.securityConfig(), now = Date.now } = {}) {
  return async function verifySession({ token, decoded, user, userAgent = '', touch = true }) {
    if (user.role !== 'admin') return null;
    const config = await getConfig(), stamp = now(), hash = tokenHash(token);
    let row = await Session.findOne({ tokenHash: hash });
    if (!row) {
      // Pre-session JWTs must sign in again. Never recreate a removed/revoked session.
      if (!decoded.sid) throw fail('Please sign in again to start a secure session.', 401);
      throw fail('This session has ended. Please sign in again.', 401);
    }
    if (String(row.user) !== String(user._id) || (row.version || 0) !== (user.sessionVersion || 0) || sessionExpired(row, config, stamp)) throw fail('This session has ended. Please sign in again.', 401);
    if (decoded.sid !== String(row._id)) throw fail('Invalid session.', 401);
    if (touch) {
      const updated = await Session.updateOne({ _id: row._id, revokedAt: null }, { $set: { lastSeenAt: new Date(stamp) } });
      if (!updated.matchedCount) throw fail('This session has ended. Please sign in again.', 401);
    }
    return row;
  };
}
async function openSession(user, req, sign, secret) {
  const Session = require('../models/AdminSession'), mongoose = require('mongoose');
  const saved = await require('../models/User').findById(user._id || user.id).select('+sessionVersion');
  if (!saved || saved.role !== 'admin' || saved.password !== user.password) throw fail('Account access has changed. Sign in again.', 401);
  const config = await securityConfig(), now = new Date(), id = new mongoose.Types.ObjectId();
  const token = sign({ user: { id: String(user._id || user.id), role: user.role }, sid: String(id) }, secret, { expiresIn: config.absoluteSessionHours * 3600 });
  await Session.create({ _id: id, tokenHash: tokenHash(token), user: user._id || user.id, version: saved.sessionVersion || 0, userAgent: String(req.headers?.['user-agent'] || 'Unknown browser').slice(0, 300), createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + config.absoluteSessionHours * 3600000) });
  return token;
}
module.exports = { assertOwner, isOwner, assertPermission, requirePermission, securityConfig, sessionExpired, createSessionVerifier, openSession, tokenHash, fail };
