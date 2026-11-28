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
  const empty = req => { query(req); if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw failure('This assistant request does not accept additional fields.', 400, 'ASSISTANT_INPUT'); };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  router.use(authenticate, authorize);
  router.use(async (req, res, next) => {
    try {
      const scope = workspace();
      if (scope || req.saas || req.workspaceRole || env.SAAS_ENABLED === 'true') {
        if (!scope || String(req.saas?.workspace?._id || '') !== String(scope._id)) {
          throw failure('Sign in to your studio workspace to manage assistant connections.', 403, 'ASSISTANT_WORKSPACE');
        }
        if (req.workspaceRole !== 'owner' || req.saas.membership?.role !== 'owner') {
          throw failure('Only the studio owner can use the assistant connections.', 403, 'ASSISTANT_OWNER');
        }
      } else if (!await isOwner(req.user.id)) {
        throw failure('Only the studio owner can use the assistant connections.', 403, 'ASSISTANT_OWNER');
      }
      next();
    } catch (error) { sendError(res, error); }
  });
  const integration = (validate, operation) => wrap(async (req, res) => {
    validate(req);
    await archiveGate.withShared(async () => res.json(await operation(req)), { integrations: true, rejectPaused: true });
  });
  router.get('/status', wrap(async (req, res) => { query(req); res.json(await api.status()); }));
  router.post('/:provider/connection', integration(query, req => api.saveConnection(req.params.provider, req.body)));
  router.delete('/:provider/connection', integration(empty, req => api.disconnect(req.params.provider)));
  router.post('/:provider/test', integration(empty, req => api.test(req.params.provider, req.user.id)));
  router.post('/:provider/draft', integration(query, req => api.draft(req.params.provider, req.body, req.user.id)));
  return router;
}
module.exports = createStudioAssistantRouter();
module.exports.createStudioAssistantRouter = createStudioAssistantRouter;
