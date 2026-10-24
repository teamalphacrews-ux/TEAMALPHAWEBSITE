import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';

import { OVERVIEW_CARDS, defaultOverviewPreferences as defaultPreferences, normalizeOverviewPreferences as normalize } from '../../../utils/overviewPreferences';
export { OVERVIEW_CARDS };

const Context = createContext(null);
export function StudioPreferencesProvider({ children }) {
  const { user, token } = useAuth();
  const key = 'teamalpha-studio-preferences:' + (user?._id || user?.id || user?.email || 'current');
  const [preferences, setPreferences] = useState(() => { try { return normalize(JSON.parse(localStorage.getItem(key) || 'null')); } catch { return defaultPreferences(); } });
  const [syncState, setSyncState] = useState(user?.isPreview ? 'preview' : 'loading');
  const current = useRef(preferences), pending = useRef(null), timer = useRef(null), sending = useRef(false), version = useRef(0), mounted = useRef(true);
  const flush = useCallback(async () => {
    if (sending.current || !pending.current || user?.isPreview || !token) return;
    sending.current = true;
    try {
      while (pending.current && mounted.current) {
        const patch = pending.current; pending.current = null; setSyncState('saving');
        try { await axios.patch(API + '/api/studio/preferences', patch, { headers: { Authorization: 'Bearer ' + token } }); if (mounted.current) setSyncState('saved'); }
        catch { pending.current = { ...patch, ...pending.current }; if (mounted.current) setSyncState('local'); break; }
      }
    } finally { sending.current = false; }
  }, [token, user?.isPreview]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (token && !user?.isPreview) axios.get(API + '/api/studio/preferences', { signal: controller.signal, headers: { Authorization: 'Bearer ' + token } }).then(result => {
      if (version.current || !result.data?.preferences) return;
      const next = normalize(result.data.preferences); current.current = next; setPreferences(next); setSyncState('saved'); localStorage.setItem(key, JSON.stringify(next));
    }).catch(() => { if (!controller.signal.aborted && !version.current) setSyncState('local'); });
    return () => { mounted.current = false; controller.abort(); clearTimeout(timer.current); };
  }, [key, token, user?.isPreview]);
  useEffect(() => {
    const previous = document.documentElement.getAttribute('data-studio-appearance');
    document.documentElement.setAttribute('data-studio-appearance', preferences.theme);
    return () => { if (previous) document.documentElement.setAttribute('data-studio-appearance', previous); else document.documentElement.removeAttribute('data-studio-appearance'); };
  }, [preferences.theme]);
  const update = useCallback(patch => {
    version.current++;
    const next = normalize({ ...current.current, ...patch }); current.current = next; setPreferences(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Server persistence remains available. */ }
    if (user?.isPreview) { setSyncState('preview'); return; }
    pending.current = { ...pending.current, ...patch, layoutVersion: 2, visibleCards: next.visibleCards };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await flush(); if (pending.current && !sending.current) timer.current = setTimeout(flush, 500); }, 350);
  }, [flush, key, user?.isPreview]);
  const toggleCard = id => update({ visibleCards: current.current.visibleCards.includes(id) ? current.current.visibleCards.filter(value => value !== id) : [...current.current.visibleCards, id] });
  return <Context.Provider value={{ preferences, update, toggleCard, resetCards: () => update({ visibleCards: defaultPreferences().visibleCards }), syncState, retrySave: () => { pending.current ||= current.current; return flush(); } }}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Shared preference provider and hook.
export function useStudioPreferences() { const context = useContext(Context); if (!context) throw new Error('Studio preferences require their provider.'); return context; }
