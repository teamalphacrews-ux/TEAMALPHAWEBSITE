const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { currentWorkspace } = require('../saas/tenantContext');
const { isStudioOwner } = require('../utils/moduleAccess');
const { createDriveBackupService, safeDriveError } = require('../services/driveBackupService');
const { createDriveBackupOAuthHandlers } = require('../utils/driveBackupOAuth');
function createDriveBackupRouter({ User = require('../models/User'), Connection = require('../models/DriveBackupConnection'),
  store = require('../models/DriveBackupOAuthNonce'), env = process.env, authenticate = auth, authorize = requireAdmin,
  service = createDriveBackupService({ Connection, env }), oauth = createDriveBackupOAuthHandlers({ User, Connection, store, env }) } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  router.get('/begin', oauth.begin); router.get('/callback', oauth.callback);
  router.use(authenticate, authorize, async (req, res, next) => { try {
    const user = await User.findById(req.user.id);
    if (currentWorkspace() || !user || user.accountDisabled || !isStudioOwner(user, { env, workspace: null })) return res.status(403).json({ message: 'Only the personal studio owner can manage workspace backup storage.' });
    next();
  } catch { res.status(503).json({ message: 'Owner permissions could not be checked.' }); } });
  const handle = handler => async (req, res) => { try { await handler(req, res); } catch (error) { const safe = safeDriveError(error); res.status(safe.status).json({ message: safe.message, code: safe.code }); } };
  router.get('/status', handle(async (req, res) => res.json(await service.status(req.user.id))));
  router.post('/connect', oauth.start);
  router.post('/disconnect', handle(async (req, res) => { await store.deleteMany({ userId: req.user.id }); await Connection.deleteOne({ userId: req.user.id }); res.json({ success: true }); }));
  router.get('/files', handle(async (req, res) => res.json(await service.list(req.user.id))));
  router.post('/files', handle(async (req, res) => res.json(await service.upload(req.user.id, req.body?.backupId))));
  router.get('/files/:id/download', handle(async (req, res) => { const result = await service.download(req.user.id, req.params.id); res.attachment(result.name).json(result.archive); }));
  return router;
}
module.exports = createDriveBackupRouter(); module.exports.createDriveBackupRouter = createDriveBackupRouter;
