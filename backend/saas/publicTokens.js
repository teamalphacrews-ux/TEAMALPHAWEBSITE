const crypto = require('node:crypto');

const LEGACY_SHARE_TOKEN = /^[a-f0-9]{64}$/;
const WORKSPACE_SHARE_TOKEN = /^([a-f0-9]{24})\.([a-f0-9]{64})$/;
const context = () => require('./tenantContext');

function isShareToken(value) {
  return typeof value === 'string' && (LEGACY_SHARE_TOKEN.test(value) || WORKSPACE_SHARE_TOKEN.test(value));
}

function parseShareWorkspaceId(value) {
  return typeof value === 'string' ? WORKSPACE_SHARE_TOKEN.exec(value)?.[1] || null : null;
}

function createShareToken() {
  const workspace = context().currentWorkspace();
  const secret = crypto.randomBytes(32).toString('hex');
  if (!workspace) return secret;
  const id = String(workspace._id);
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('Invalid workspace context.');
  return `${id}.${secret}`;
}

function requestShareToken(req) {
  // originalUrl remains complete when this middleware is mounted under /api.
  // The complete token, including its prefix, participates in the stored hash.
  const paths = [req.originalUrl, req.path].filter(value => typeof value === 'string');
  for (const value of paths) {
    const path = value.split('?')[0];
    const match = /^\/(?:api\/)?(?:quotes|public-invoices)\/([^/]+)(?:\/|$)/.exec(path);
    if (match) return { matched: true, token: match[1] };
  }
  return { matched: false };
}

function createPublicWorkspaceMiddleware({
  Workspace,
  runInWorkspace = (...args) => context().runInWorkspace(...args),
} = {}) {
  return async function publicWorkspace(req, res, next) {
    const route = requestShareToken(req);
    if (!route.matched) return next();
    const unavailable = () => res.status(404).json({ error: 'This client link is unavailable. Please contact the studio.' });
    if (!isShareToken(route.token)) return unavailable();
    const id = parseShareWorkspaceId(route.token);
    if (!id) return runInWorkspace(null, next);
    try {
      const Registry = Workspace || require('mongoose').connection.model('SaaSWorkspace');
      const workspace = await Registry.findOne({ _id: id, state: 'active' });
      if (!workspace || workspace.state !== 'active' || String(workspace._id) !== id || workspace.databaseName !== `studio_${id}`) return unavailable();
      req.workspace = workspace;
      return runInWorkspace(workspace, next);
    } catch {
      // A tenant-prefixed token must never retry against the legacy database.
      return res.status(503).json({ error: 'Client links are temporarily unavailable. Please retry shortly.' });
    }
  };
}

module.exports = { createShareToken, isShareToken, parseShareWorkspaceId, createPublicWorkspaceMiddleware };
