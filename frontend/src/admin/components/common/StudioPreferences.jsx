import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';
import { OVERVIEW_CARDS, defaultOverviewPreferences as defaultPreferences, normalizeOverviewPreferences as normalize, moveOverviewCard } from '../../../utils/overviewPreferences';
import { cancelStudioThemeTransition, transitionStudioTheme } from '../../../utils/studioThemeTransition';
import '../../studio-theme-transition.css';
export { OVERVIEW_CARDS };

const Context = createContext(null);
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
function preferencePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  // A fresh patch is already on the current layout version; do not reintroduce
  // the finance card when somebody deliberately hides it.
  const normalized = normalize({ ...value, layoutVersion: 3 });
  const entries = Object.keys(defaultPreferences()).filter(key => Object.hasOwn(value, key)).map(key => [key, normalized[key]]);
  return entries.length ? Object.fromEntries(entries) : null;
}

export function StudioPreferencesProvider({ children }) {
  const { user, token } = useAuth();
  const storageKey = 'teamalpha-studio-preferences:' + (user?._id || user?.id || user?.email || 'current');
  // Remount all request state when the account/session changes. An old response can
  // never update another administrator's preference cache or queued writes.
  return <AccountPreferences key={storageKey + ':' + (token || '')} storageKey={storageKey} token={token} preview={user?.isPreview === true}>{children}</AccountPreferences>;
}

function AccountPreferences({ children, storageKey, token, preview }) {
  const [preferences, setPreferences] = useState(() => normalize(read(storageKey)));
  const [syncState, setSyncState] = useState(preview ? 'preview' : 'loading');
  const [ready, setReady] = useState(preview || !token);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const current = useRef(preferences), pending = useRef(preview ? null : preferencePatch(read(storageKey + ':pending')));
  const intendedTheme = useRef(preferences.theme);
  const inFlight = useRef(null), timer = useRef(null), sending = useRef(false), mounted = useRef(true), hydrated = useRef(preview || !token), requestController = useRef(null);
  const location = useLocation(), navigate = useNavigate();
  const resolvedTheme = preferences.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.theme;
  useEffect(() => { intendedTheme.current = preferences.theme; }, [preferences.theme]);
  const persistPending = useCallback(() => write(storageKey + ':pending', inFlight.current || pending.current ? { ...inFlight.current, ...pending.current } : null), [storageKey]);
  const flush = useCallback(async () => {
    if (sending.current || !hydrated.current || !pending.current || preview || !token || !mounted.current) return;
    sending.current = true;
    try {
      while (pending.current && mounted.current) {
        const patch = pending.current; pending.current = null; inFlight.current = patch; persistPending(); setSyncState('saving');
        try {
          const result = await axios.patch(API + '/api/studio/preferences', patch, { signal: requestController.current?.signal, timeout: 20000, headers: { Authorization: 'Bearer ' + token } });
          if (!mounted.current) return;
          if (!result.data?.preferences) throw new Error('Preferences were not confirmed.');
          const next = normalize({ ...result.data.preferences, ...pending.current });
          current.current = next; setPreferences(next); write(storageKey, next);
          inFlight.current = null; persistPending(); setSyncState(pending.current ? 'saving' : 'saved');
        } catch {
          if (!mounted.current) return;
          pending.current = { ...patch, ...pending.current }; inFlight.current = null;
          setSyncState(persistPending() ? 'local' : 'memory'); break;
        }
      }
    } finally { sending.current = false; }
  }, [persistPending, preview, storageKey, token]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(); requestController.current = controller;
    if (token && !preview) {
      axios.get(API + '/api/studio/preferences', { signal: controller.signal, timeout: 20000, headers: { Authorization: 'Bearer ' + token } }).then(result => {
        if (!mounted.current) return;
        if (!result.data?.preferences) throw new Error('Preferences were not returned.');
        const next = normalize({ ...result.data.preferences, ...pending.current });
        current.current = next; setPreferences(next); write(storageKey, next); setSyncState(pending.current ? 'saving' : 'saved');
      }).catch(() => { if (mounted.current && !controller.signal.aborted) setSyncState(write(storageKey, current.current) ? 'local' : 'memory'); }).finally(() => {
        if (!mounted.current || controller.signal.aborted) return;
        hydrated.current = true; setReady(true); flush();
      });
    }
    return () => { mounted.current = false; controller.abort(); clearTimeout(timer.current); };
  }, [flush, preview, storageKey, token]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = html.getAttribute('data-studio-appearance'), previousMotion = html.getAttribute('data-studio-motion');
    html.setAttribute('data-studio-appearance', resolvedTheme);
    html.setAttribute('data-studio-motion', preferences.reduceMotion ? 'reduced' : 'standard');
    return () => {
      if (previous) html.setAttribute('data-studio-appearance', previous); else html.removeAttribute('data-studio-appearance');
      if (previousMotion) html.setAttribute('data-studio-motion', previousMotion); else html.removeAttribute('data-studio-motion');
    };
  }, [resolvedTheme, preferences.reduceMotion]);
  useEffect(() => () => cancelStudioThemeTransition(), []);
  useEffect(() => {
    if (ready && location.pathname === '/admin' && location.state?.studioSignIn === true) navigate(preferences.landingPage, { replace: true, state: null });
  }, [ready, location.pathname, location.state, navigate, preferences.landingPage]);

  const update = useCallback((value, { origin } = {}) => {
    const patch = preferencePatch(value);
    if (!patch) return;
    if (patch.reduceMotion === true) {
      cancelStudioThemeTransition();
      if (intendedTheme.current !== current.current.theme) patch.theme = intendedTheme.current;
    }
    const apply = () => {
      const next = normalize({ ...current.current, ...patch }); current.current = next; setPreferences(next);
      const local = write(storageKey, next);
      if (preview || !token) { setSyncState(local ? 'preview' : 'memory'); return; }
      pending.current = { ...pending.current, ...patch, layoutVersion: 3, cardOrder: next.cardOrder, visibleCards: next.visibleCards }; persistPending();
      setSyncState('saving'); clearTimeout(timer.current); timer.current = setTimeout(flush, 350);
    };
    if (Object.hasOwn(patch, 'theme')) {
      intendedTheme.current = patch.theme;
      const resolve = theme => theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
      if (resolve(current.current.theme) !== resolve(patch.theme)) return transitionStudioTheme({ origin,
        reduceMotion: patch.reduceMotion ?? current.current.reduceMotion, commit: () => flushSync(apply) });
      cancelStudioThemeTransition();
    }
    apply();
  }, [flush, persistPending, preview, storageKey, token, systemDark]);
  const toggleTheme = origin => {
    const mode = intendedTheme.current === 'system' ? (systemDark ? 'dark' : 'light') : intendedTheme.current;
    return update({ theme: mode === 'dark' ? 'light' : 'dark' }, { origin });
  };
  const toggleCard = id => update({ visibleCards: current.current.visibleCards.includes(id) ? current.current.visibleCards.filter(value => value !== id) : [...current.current.visibleCards, id] });
  const moveCard = (id, direction) => update({ cardOrder: moveOverviewCard(current.current.cardOrder, id, direction) });
  const resetCards = () => { const defaults = defaultPreferences(); update({ visibleCards: defaults.visibleCards, cardOrder: defaults.cardOrder }); };
  const retrySave = () => {
    if (preview || !token) { setSyncState(write(storageKey, current.current) ? 'preview' : 'memory'); return; }
    pending.current ||= current.current; persistPending(); return flush();
  };
  return <Context.Provider value={{ preferences, resolvedTheme, update, toggleTheme, toggleCard, moveCard, resetCards, resetPreferences: () => update(defaultPreferences()), syncState, retrySave }}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Shared preference provider and hook.
export function useStudioPreferences() { const context = useContext(Context); if (!context) throw new Error('Studio preferences require their provider.'); return context; }
