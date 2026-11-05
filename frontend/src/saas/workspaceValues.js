export function workspaceId(value) {
  const id = value?.id || value?._id;
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : '';
}
export const isWorkspaceSession = value => typeof value?.token === 'string' && value.token.trim().length > 0 && value.user?.role === 'admin' && Boolean(workspaceId(value.user?.workspace));
const roles = { owner: 'Owner', admin: 'Administrator', staff: 'Team member', removed: 'Removed' };
const states = { trialing: 'Free trial', trial: 'Free trial', active: 'Active', past_due: 'Payment due', paused: 'Paused', cancelled: 'Cancelled', canceled: 'Cancelled', expired: 'Trial ended', suspended: 'Suspended', pending: 'Pending activation', incomplete: 'Pending activation', created: 'Pending activation', authenticated: 'Pending activation', halted: 'Payment due', completed: 'Completed' };
export const roleLabel = role => Object.hasOwn(roles, role) ? roles[role] : 'Team member';
export const statusLabel = value => Object.hasOwn(states, value) ? states[value] : 'Pending activation';
export const safeDate = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
};
export const trialDaysLeft = value => {
  const stamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(stamp) ? Math.max(0, Math.ceil((stamp - Date.now()) / 86400000)) : null;
};
export function planPrice(plan) {
  if (!Number.isFinite(plan?.monthlyAmount) || plan.monthlyAmount <= 0) return null;
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: plan.currency || 'INR', maximumFractionDigits: 0 }).format(plan.monthlyAmount); }
  catch { return null; }
}
