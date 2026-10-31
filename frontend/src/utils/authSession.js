export function cleanSessionToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return cleaned && cleaned !== 'null' && cleaned !== 'undefined' ? cleaned : null;
}

// Responses from a previous sign-in must never invalidate the current account.
export function isCurrentSession(expectedToken, currentSession, storedToken) {
  return Boolean(expectedToken && currentSession?.token === expectedToken && cleanSessionToken(storedToken) === expectedToken);
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
    return { status: 'valid', user };
  } catch {
    return { status: signal?.aborted ? 'cancelled' : 'unavailable' };
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', cancel);
  }
}
