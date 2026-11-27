export function cleanSessionToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return cleaned && cleaned !== 'null' && cleaned !== 'undefined' ? cleaned : null;
}

// A workspace switch writes token and user separately. Both identify the
// verification request even when another tab has only received the first write.
export function sessionIdentity(session) {
  const token = cleanSessionToken(session?.token);
  if (!token || !session.user) return '';
  const user = session.user;
  const workspace = user.workspace;
  return JSON.stringify([token, String(user._id || user.id || ''),
    String(typeof workspace === 'string' ? workspace : workspace?._id || workspace?.id || ''), user.isPreview === true]);
}

export function isCurrentSession(expectedIdentity, currentSession, storedSession) {
  return Boolean(expectedIdentity && sessionIdentity(currentSession) === expectedIdentity && sessionIdentity(storedSession) === expectedIdentity);
}

// Public capability links must survive expiration of an unrelated admin sign-in.
export function shouldRedirectExpiredSession(pathname) {
  return /^\/admin(?:\/|$)/.test(pathname || '');
}

// Storage events can describe expiry or an intermediate sign-in write. Only a
// deliberate sign-out or a verified switch may remove another account's drafts.
export function draftScopeToPurge(previousScope, nextScope, { verified = false, explicitLogout = false } = {}) {
  if (explicitLogout) return previousScope || '';
  return verified && previousScope && nextScope && previousScope !== nextScope ? previousScope : '';
}

export async function verifyStoredSession(session, { fetcher, api = '', signal, timeoutMs = 15000 } = {}) {
  if (!session?.token || !session.user) return { status: 'missing' };
  if (session.user.isPreview === true) return { status: 'valid', user: session.user };
  const requestController = new AbortController();
  const cancel = () => requestController.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetcher(api + '/api/auth/me', { headers: { Authorization: 'Bearer ' + session.token }, signal: requestController.signal });
    if (response.status === 401 || response.status === 403) return { status: 'expired' };
    if (!response.ok) return { status: 'unavailable' };
    const profile = await response.json();
    const id = String(profile?._id || profile?.id || '');
    if (profile?.role !== 'admin' || !id || id !== String(session.user._id || session.user.id || '')) return { status: 'expired' };
    // Keep workspace metadata while accepting only verified identity fields.
    const user = { ...session.user, id, role: profile.role };
    for (const field of ['firstName', 'lastName', 'email']) if (typeof profile[field] === 'string') user[field] = profile[field];
    user.moduleAccess = Array.isArray(profile.moduleAccess) ? [...profile.moduleAccess] : profile.moduleAccess == null ? null : [];
    user.studioOwner = profile.studioOwner === true;
    user.canManageTeam = profile.canManageTeam === true;
    user.workspaceDataVersion = Number.isSafeInteger(profile.workspaceDataVersion) && profile.workspaceDataVersion >= 0 ? profile.workspaceDataVersion : 0;
    if (profile.workspace && typeof profile.workspace.setupRequired === 'boolean') {
      const workspace = profile.workspace;
      if (typeof workspace.id !== 'string' || !workspace.id || (user.workspace?.id && user.workspace.id !== workspace.id)) return { status: 'expired' };
      user.workspace = { ...user.workspace, id: workspace.id, setupRequired: workspace.setupRequired };
      if (typeof workspace.name === 'string') user.workspace.name = workspace.name;
      if (['owner', 'admin', 'staff'].includes(profile.workspaceRole)) {
        user.workspaceRole = profile.workspaceRole;
        user.workspace.role = profile.workspaceRole;
      }
    }
    delete user.owner;
    return { status: 'valid', user };
  } catch {
    return { status: signal?.aborted ? 'cancelled' : 'unavailable' };
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', cancel);
  }
}
