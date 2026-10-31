import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {clearLocalDrafts,draftScope} from '../offline/draftVault';
import {disconnectNativeDevice} from '../native/deviceFeatures';
import API from '../utils/apiConfig';
import { notifyNativeWorkspaceChanged } from '../native/nativeCapabilities';
import { cleanSessionToken as cleanToken, draftScopeToPurge, isCurrentSession, shouldRedirectExpiredSession, verifyStoredSession } from '../utils/authSession';

const AuthContext = createContext();
const readStoredSession = () => {
  try {
    const rawToken = localStorage.getItem('token');
    const token = cleanToken(rawToken);
    if (token && rawToken !== token) localStorage.setItem('token', token);
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.role !== 'admin') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { token: null, user: null };
    }
    return token && user && typeof user === 'object' ? { token, user } : { token: null, user: null };
  } catch { return { token: null, user: null }; }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readStoredSession);
  const [verification, setVerification] = useState({ token: null, status: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const currentLocation = useRef(location);
  useEffect(() => { currentLocation.current = location; }, [location]);
  const currentSession=useRef(session);
  const lastDraftScope = useRef(draftScope(session.user));
  const replaceSession = useCallback(next => { currentSession.current = next; setSession(next); }, []);
  const expireSession = useCallback(expectedToken => {
    if (!isCurrentSession(expectedToken, currentSession.current, localStorage.getItem('token'))) return;
    localStorage.removeItem('token'); localStorage.removeItem('user');
    notifyNativeWorkspaceChanged();
    // An expired session is recoverable. Keep encrypted drafts for re-sign-in.
    replaceSession({ user: null, token: null });
    if (shouldRedirectExpiredSession(currentLocation.current.pathname)) navigate('/auth', { replace: true, state: { reason: 'session-expired' } });
  }, [navigate, replaceSession]);
  const login = useCallback(async (user, userToken) => {
    const token = cleanToken(userToken);
    if (!token || user?.role !== 'admin') return;
    const old=readStoredSession();
    const nextScope = draftScope(user), purgeScope = draftScopeToPurge(lastDraftScope.current, nextScope, { verified: true });
    if (purgeScope) await clearLocalDrafts(purgeScope);
    if(old.token&&old.token!==token)await disconnectNativeDevice(old.token);
    lastDraftScope.current = nextScope;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    notifyNativeWorkspaceChanged();
    replaceSession({ token, user });
    // Only a fresh sign-in should open the person's preferred start page.
    navigate('/admin', { state: { studioSignIn: true } });
  }, [navigate, replaceSession]);
  const logout = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) fetch(API + '/api/studio/security/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, keepalive: true }).catch(() => {});
    const previousScope=draftScopeToPurge(lastDraftScope.current || draftScope(currentSession.current.user), '', { explicitLogout: true });
    Object.keys(localStorage).forEach(key => { if (key.startsWith('gallery_unlocked_')) localStorage.removeItem(key); });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    notifyNativeWorkspaceChanged();
    replaceSession({ user: null, token: null });
    lastDraftScope.current = '';
    navigate('/auth');
    if (previousScope) await clearLocalDrafts(previousScope);
    await disconnectNativeDevice(token);
  }, [navigate, replaceSession]);
  useEffect(()=>{
    const changed=event=>{if(event.key!=='user'&&event.key!=='token')return;const next=readStoredSession(),old=currentSession.current;
      if(old.token!==next.token||draftScope(old.user)!==draftScope(next.user)){notifyNativeWorkspaceChanged();currentSession.current=next;setSession(next);}
    };window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[]);
  useEffect(() => {
    if (!session.token || session.user?.isPreview === true) return;
    const controller = new AbortController(), token = session.token;
    verifyStoredSession(session, { fetcher: fetch, api: API, signal: controller.signal }).then(async result => {
      if (controller.signal.aborted || !isCurrentSession(token, currentSession.current, localStorage.getItem('token'))) return;
      if (result.status === 'expired') { expireSession(token); return; }
      if (result.status === 'valid') {
        const nextScope = draftScope(result.user), purgeScope = draftScopeToPurge(lastDraftScope.current, nextScope, { verified: true });
        if (purgeScope) await clearLocalDrafts(purgeScope);
        if (controller.signal.aborted || !isCurrentSession(token, currentSession.current, localStorage.getItem('token'))) return;
        lastDraftScope.current = nextScope;
        localStorage.setItem('user', JSON.stringify(result.user));
        replaceSession({ token, user: result.user });
      }
      setVerification({ token, status: result.status });
    });
    return () => controller.abort();
    // A profile update must not restart verification of the same sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, session.user?.isPreview, expireSession, replaceSession]);
  useEffect(() => {
    if (!session.token || session.user?.role !== 'admin' || session.user?.isPreview === true || verification.token !== session.token) return;
    let lastActivity = 0;
    const controller = new AbortController();
    const activity = event => {
      if ((event && !event.isTrusted) || document.visibilityState === 'hidden' || Date.now() - lastActivity < 60000) return;
      lastActivity = Date.now();
      fetch(API + '/api/studio/security/activity', { method: 'POST', headers: { Authorization: 'Bearer ' + session.token }, signal: controller.signal }).then(result => { if (!controller.signal.aborted && result.status === 401) expireSession(session.token); }).catch(() => {});
    };
    activity();
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, activity, { passive: true, capture: true }));
    return () => { controller.abort(); events.forEach(event => window.removeEventListener(event, activity, { capture: true })); };
  }, [session.token, session.user?.role, session.user?.isPreview, verification.token, expireSession]);
  const updateUser = useCallback(userData => {
    setSession(current => {
      const user = { ...current.user, ...userData };
      localStorage.setItem('user', JSON.stringify(user));
      const next = { ...current, user }; currentSession.current = next; return next;
    });
  }, []);
  const loading = Boolean(session.token && session.user?.isPreview !== true && verification.token !== session.token);
  const sessionError = verification.token === session.token && verification.status === 'unavailable' ? 'Your studio connection is temporarily unavailable. Your sign-in and local drafts have been kept.' : '';
  const value = useMemo(() => ({ ...session, loading, sessionError, login, logout, updateUser }), [session, loading, sessionError, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
// eslint-disable-next-line react-refresh/only-export-components -- Preserve the existing provider and consumer-hook import API.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
