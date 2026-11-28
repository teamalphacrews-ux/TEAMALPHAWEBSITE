import { hasModuleAccess } from './moduleAccess.js';

// For creating and editing studio records. Destructive actions and account
// settings have their own endpoint-specific rules. The API remains authoritative.
export function canWriteWorkspaceModule(user, module, now = Date.now()) {
  if (!hasModuleAccess(user, module)) return false;
  const workspace = user.workspace;
  const role = user.workspaceRole || workspace?.role;
  if (!workspace && !role) return true; // Existing single-studio accounts.
  if (workspace?.state && workspace.state !== 'active') return false;
  const status = workspace?.subscriptionStatus || workspace?.status;
  if (status && status !== 'active' &&
    !(status === 'trialing' && new Date(workspace.trialEndsAt).getTime() > now)) return false;
  if (role === 'owner' || role === 'admin') return true;
  return role === 'staff' && ['calendar', 'production', 'crew', 'support'].includes(module);
}

export function canDeleteWorkspaceModule(user, module, now = Date.now()) {
  return user?.role === 'admin' && canWriteWorkspaceModule(user, module, now) &&
    (user.workspaceRole || user.workspace?.role) !== 'staff';
}
