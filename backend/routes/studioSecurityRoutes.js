const express = require('express');
const auth = require('../middleware/auth'), requireAdmin = require('../middleware/requireAdmin');
const security = require('../services/studioSecurity');
const recovery = require('../services/studioRecovery');
const Session = require('../models/AdminSession'), Backup = require('../models/StudioBackup'), Recovery = require('../models/RecoveryRecord');
const router = express.Router();
router.use(auth, requireAdmin);
const wrap = handler => async (req, res) => { try { await handler(req, res); } catch (e) { res.status(e.status || (e.code === 11000 ? 409 : 503)).json({ error: e.status ? e.message : e.code === 11000 ? 'A conflicting record exists. Restore was rolled back; nothing was overwritten.' : 'The operation could not finish. No private details were exposed.' }); } };
const id = value => { if (!/^[a-f\d]{24}$/i.test(value || '')) throw security.fail('Invalid record identity.', 400); return value; };
// Express middleware has a separate wrapper to retain next().
const requireOwner = async (req, res, next) => { try { await security.assertOwner(req.user.id); next(); } catch (e) { res.status(e.status || 503).json({ error: e.status ? e.message : 'Owner checks are unavailable.' }); } };
router.get('/access', wrap(async (req, res) => {
  const owner = await security.isOwner(req.user.id), config = await security.securityConfig();
  res.json({ owner, currentSessionId: req.sessionId, permissions: Object.fromEntries(Object.entries(config.permissions).map(([key, rule]) => [key, rule === 'all_admins' || owner])) });
}));
router.get('/sessions', wrap(async (req, res) => {
  const rows = await Session.find({ user: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean(), config = await security.securityConfig();
  res.json(rows.filter(row => !security.sessionExpired(row, config)).map(row => ({ id: String(row._id), current: String(row._id) === req.sessionId, userAgent: row.userAgent, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, expiresAt: row.expiresAt })));
}));
// Explicit user-activity heartbeat: background polling must not keep an idle
// administrator signed in indefinitely.
router.post('/activity', wrap(async (req, res) => {
  const result = await Session.updateOne({ _id: req.sessionId, user: req.user.id, revokedAt: null }, { $set: { lastSeenAt: new Date() } });
  if (!result.matchedCount) throw security.fail('Session ended.', 401);
  res.json({ active: true });
}));
function disconnectSession(req, sessionId) { for (const socket of req.app.get('io')?.sockets?.sockets?.values?.() || []) if (socket.sessionId === sessionId) socket.disconnect(true); }
router.delete('/sessions/:id', wrap(async (req, res) => {
  const sessionId = id(req.params.id), result = await Session.updateOne({ _id: sessionId, user: req.user.id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!result.matchedCount) throw security.fail('Session not found.', 404);
  disconnectSession(req, sessionId); res.json({ revoked: true, current: sessionId === req.sessionId });
}));
router.post('/sessions/revoke-all', wrap(async (req, res) => {
  const includeCurrent = req.body?.includeCurrent === true;
  await Session.updateMany({ user: req.user.id, ...(includeCurrent ? {} : { _id: { $ne: req.sessionId } }) }, { $set: { revokedAt: new Date() } });
  for (const socket of req.app.get('io')?.sockets?.sockets?.values?.() || []) if (socket.user?.id === req.user.id && (includeCurrent || socket.sessionId !== req.sessionId)) socket.disconnect(true);
  res.json({ revoked: true, current: includeCurrent });
}));
router.post('/logout', wrap(async (req, res) => { await Session.updateOne({ _id: req.sessionId, user: req.user.id }, { $set: { revokedAt: new Date() } }); disconnectSession(req, req.sessionId); res.json({ signedOut: true }); }));
router.get('/backups', requireOwner, wrap(async (_req, res) => { res.json({ backups: await Backup.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(30).lean(), limits: { maxSnapshots: 30, maxBytes: recovery.MAX_BYTES, maxRecords: recovery.MAX_RECORDS }, keyConfigured: !!(process.env.BACKUP_SECRET || process.env.VAULT_SECRET) }); }));
router.post('/backups', requireOwner, wrap(async (req, res) => { const row = await recovery.createBackup({ actorId: req.user.id }); res.status(201).json({ id: row._id, createdAt: row.createdAt, counts: row.counts }); }));
router.get('/backups/:id/download', requireOwner, security.requirePermission('exports'), wrap(async (req, res) => {
  const row = await Backup.findOne({ _id: id(req.params.id), expiresAt: { $gt: new Date() } }).select('+encrypted');
  if (!row) throw security.fail('Backup not found.', 404);
  res.set('Cache-Control', 'no-store'); res.set('Content-Disposition', `attachment; filename="teamalpha-records-${String(row._id)}.json"`); res.json(recovery.unseal(row.encrypted));
}));
router.post('/backups/:id/restore', requireOwner, wrap(async (req, res) => {
  if (req.body?.confirmation !== 'RESTORE MISSING RECORDS') throw security.fail('Type RESTORE MISSING RECORDS to confirm.', 400);
  const result = await recovery.inTransaction(async session => {
    const row = await Backup.findOne({ _id: id(req.params.id), expiresAt: { $gt: new Date() } }).select('+encrypted').session(session);
    if (!row) throw security.fail('Backup not found.', 404);
    const result = await recovery.mergeSnapshot(recovery.unseal(row.encrypted), session);
    row.restoredAt = new Date(); await row.save({ session }); return result;
  });
  res.json(result);
}));
router.get('/recovery', requireOwner, wrap(async (_req, res) => res.json(await Recovery.find({ restoredAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(100).lean())));
router.post('/recovery/:id/restore', requireOwner, wrap(async (req, res) => {
  if (req.body?.confirmation !== 'RESTORE RECORD') throw security.fail('Type RESTORE RECORD to confirm.', 400);
  res.json(await recovery.restoreRecovery({ id: id(req.params.id), actorId: req.user.id }));
}));
module.exports = router;
