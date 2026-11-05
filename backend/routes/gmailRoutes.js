const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { createGmailOAuthHandlers } = require('../utils/gmailOAuth');
const { createGmailService, safeGmailError } = require('../services/gmailService');

function createGmailRouter({ User = require('../models/User'), Connection = require('../models/GmailConnection'),
  store = require('../models/GmailOAuthNonce'), env = process.env, authenticate = auth, authorize = requireAdmin,
  service = createGmailService({ Connection, env }), oauth = createGmailOAuthHandlers({ User, Connection, store, env }),
} = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  router.get('/begin', oauth.begin);
  router.get('/callback', oauth.callback);
  router.use(authenticate, authorize);
  router.get('/status', async (req, res) => {
    try { res.json(await service.status(req.user.id)); }
    catch { res.status(503).json({ message: 'Gmail connection status is unavailable. Please try again.' }); }
  });
  router.post('/connect', oauth.start);
  router.post('/disconnect', async (req, res) => {
    try {
      await store.deleteMany({ userId: req.user.id });
      await Connection.deleteOne({ userId: req.user.id });
      // Do not revoke a shared Google client grant: that can disconnect Calendar.
      res.json({ success: true });
    } catch { res.status(503).json({ message: 'Gmail could not be disconnected. Please try again.' }); }
  });
  const read = handler => async (req, res) => {
    try { res.json(await handler(req)); }
    catch (error) { const safe = safeGmailError(error); res.status(safe.status).json({ message: safe.message, code: safe.code }); }
  };
  router.get('/messages', read(req => service.list(req.user.id, req.query)));
  router.get('/messages/:id', read(req => service.detail(req.user.id, req.params.id)));
  return router;
}

module.exports = createGmailRouter();
module.exports.createGmailRouter = createGmailRouter;
