const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const security = require('../services/studioSecurity');
const { currentWorkspace } = require('../saas/tenantContext');
const { createStudioAssistantService, safeAssistantError } = require('../services/studioAssistantService');
const failure = (message, status, code) => Object.assign(new Error(message), { status, code });
function createStudioAssistantRouter({ service, env = process.env, authenticate = auth, authorize = requireAdmin, isOwner = id => security.isOwner(id), workspace = currentWorkspace, archiveGate = require('../services/studioArchiveGate') } = {}) {
  const router = express.Router(), api = service || createStudioAssistantService({ env });
  const sendError = (res, error) => { const safe = safeAssistantError(error); res.status(safe.status).json({ error: safe.message, code: safe.code }); };
  const wrap = handler => async (req, res) => { try { await handler(req, res); } catch (error) { sendError(res, error); } };
  const query = req => { if (Object.keys(req.query || {}).length) throw failure('This assistant request contains unsupported query parameters.', 400, 'ASSISTANT_INPUT'); };
  const empty = req => { query(req); if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw failure('The connection test does not accept additional fields.', 400, 'ASSISTANT_INPUT'); };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  router.use(authenticate, authorize);
  router.use(async (req, res, next) => {
    try {
      if (workspace()) throw failure('Assistant connections are not yet enabled for commercial studio workspaces.', 409, 'ASSISTANT_WORKSPACE_PENDING');
      if (!await isOwner(req.user.id)) throw failure('Only the studio owner can use the assistant connections.', 403, 'ASSISTANT_OWNER');
      next();
    } catch (error) { sendError(res, error); }
  });
  router.get('/status', wrap(async (req, res) => { query(req); res.json(await api.status()); }));
  router.post('/:provider/test', wrap(async (req, res) => { empty(req); await archiveGate.withShared(async () => res.json(await api.test(req.params.provider, req.user.id)), { integrations: true, rejectPaused: true }); }));
  router.post('/:provider/draft', wrap(async (req, res) => { query(req); await archiveGate.withShared(async () => res.json(await api.draft(req.params.provider, req.body, req.user.id)), { integrations: true, rejectPaused: true }); }));
  return router;
}
module.exports = createStudioAssistantRouter();
module.exports.createStudioAssistantRouter = createStudioAssistantRouter;
