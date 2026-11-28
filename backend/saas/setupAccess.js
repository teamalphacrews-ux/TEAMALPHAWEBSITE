// Only new studios are provisioned with a progress marker. Existing studios
// already use the workspace and keep access even if their profile is sparse.
const requiresSetup = workspace => workspace?.setupStep != null;
function allowedDuringSetup(method, path, role) {
  if (role === 'owner' && ['GET', 'POST'].includes(method) && path === '/api/saas/workspace/reset') return true;
  if (method === 'GET') return [
    '/api/auth/me', '/api/saas/config', '/api/saas/setup', '/api/saas/workspaces',
  ].includes(path);
  if (method === 'PATCH') return path === '/api/saas/setup';
  if (method !== 'POST') return false;
  return path === '/api/saas/setup/complete' ||
    path === '/api/studio/security/activity' || path === '/api/studio/security/logout' ||
    /^\/api\/saas\/workspaces\/[a-f\d]{24}\/switch$/i.test(path) ||
    (role === 'owner' && (path === '/api/studio/profile-images' || path === '/api/saas/setup/restart'));
}
module.exports = { requiresSetup, allowedDuringSetup };
