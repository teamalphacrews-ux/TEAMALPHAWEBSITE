const jwt = require('jsonwebtoken');
const { runInWorkspace } = require('./tenantContext');
const { accessStatus } = require('./plans');
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const failure = (status, message) => Object.assign(new Error(message), { status });
function readToken(req) {
  const value = req.headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : req.headers?.['x-auth-token'];
}
async function resolveSession(token, { models = require('./models'), env = process.env } = {}) {
  let decoded;
  try { decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }); } catch { throw failure(401, 'Please sign in again.'); }
  if (!decoded.workspaceId) return null;
  if (env.SAAS_ENABLED !== 'true' || !validId(decoded.workspaceId) || !validId(decoded.accountId) || !validId(decoded.user?.id)) throw failure(401, 'Workspace session is not valid.');
  const [account, workspace, membership] = await Promise.all([
    models.Account.findOne({ _id: decoded.accountId, state: 'active' }),
    models.Workspace.findOne({ _id: decoded.workspaceId, state: 'active' }),
    models.Membership.findOne({ workspaceId: decoded.workspaceId, accountId: decoded.accountId, state: 'active', localUserId: decoded.user.id }),
  ]);
  if (!account || !workspace || !membership) throw failure(401, 'Your access to this studio has ended.');
  return { account, workspace, membership, decoded };
}
const isRead = method => ['GET', 'HEAD', 'OPTIONS'].includes(method);
function requestAllowed(role, method, path) {
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'staff') return false;
  if (/^\/api\/(?:saas|auth\/(?:me|profile)|studio\/(?:devices|preferences|security\/(?:activity|logout)))\b/.test(path)) return true;
  if (/^\/api\/(?:admin-users|google-sheets|media|drive-gallery|integrations)\b/.test(path)) return false;
  if (/^\/api\/(?:finance|invoices)\b/.test(path)) return isRead(method);
  if (/^\/api\/studio\/(?:settings|security|backup|recovery|quotes|invoices|quote-templates)/.test(path)) return isRead(method) && path === '/api/studio/settings';
  if (isRead(method)) return true;
  return method !== 'DELETE' && /^\/api\/(?:calendar|tasks|photographers|project-support|notifications)\b/.test(path);
}
function createWorkspaceMiddleware({ models, env = process.env, onWorkspace = () => {} } = {}) {
  return async (req, res, next) => {
    if (/^\/api\/(?:quotes|public-invoices)\//.test(req.originalUrl || '')) return next();
    const token = readToken(req);
    if (!token) return next();
    try {
      const session = await resolveSession(token, { models, env });
      if (!session) return next();
      const { account, workspace, membership } = session;
      const path = req.originalUrl.split('?')[0];
      // Existing global integration credentials are never inherited by a new studio.
      if (/^\/api\/(?:integrations|google-sheets|media|drive-gallery|gallery|chats|auth\/google)(?:\/|$)/.test(path))
        return res.status(409).json({ msg: 'This integration is being prepared for independent studios. Your workspace data remains available.', code: 'SAAS_INTEGRATION_PENDING' });
      if (path.startsWith('/api/admin-users')) return res.status(409).json({ msg: 'Manage studio members and invitations from Workspace & plan.' });
      if (!requestAllowed(membership.role, req.method, path)) return res.status(403).json({ msg: 'Your studio role does not allow this action.' });
      const status = accessStatus(workspace);
      if (status === 'read_only' && !isRead(req.method) && !/^\/api\/(?:saas|auth|studio\/(?:devices|preferences|security\/(?:activity|logout)))(?:\/|$)/.test(path))
        return res.status(402).json({ msg: 'Your studio is read-only. Ask the owner to renew the monthly subscription.', code: 'SUBSCRIPTION_REQUIRED' });
      req.saas = session;
      req.workspaceRole = membership.role;
      return runInWorkspace(workspace, () => { onWorkspace(workspace); return next(); });
    } catch (error) { return res.status(error.status || 503).json({ msg: error.status ? error.message : 'Workspace access is temporarily unavailable.' }); }
  };
}
module.exports = { createWorkspaceMiddleware, resolveSession, requestAllowed, readToken, validId, failure };
