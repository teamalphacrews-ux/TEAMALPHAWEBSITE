import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';

const RegisterModuleSearch = createContext(null);
const ActiveModuleSearch = createContext(null);

export function WorkspaceModuleSearchProvider({ children }) {
  const [search, setSearch] = useState(null);
  const register = useCallback(entry => {
    setSearch(entry);
    return () => setSearch(current => current === entry ? null : current);
  }, []);

  return <RegisterModuleSearch.Provider value={register}>
    <ActiveModuleSearch.Provider value={search}>{children}</ActiveModuleSearch.Provider>
  </RegisterModuleSearch.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Paired with the workspace search provider.
export function useActiveWorkspaceModuleSearch() {
  return useContext(ActiveModuleSearch);
}

// eslint-disable-next-line react-refresh/only-export-components -- Page-level registration for the workspace search provider.
export function useWorkspaceModuleSearch({ label, query = '', onChange, maxLength = 512, enabled = true }) {
  const register = useContext(RegisterModuleSearch);
  const apply = useRef(onChange);
  const active = IS_COMMERCIAL_DEPLOYMENT && Boolean(register) && enabled;

  useLayoutEffect(() => { apply.current = onChange; }, [onChange]);
  useLayoutEffect(() => {
    if (!active) return undefined;
    return register({ label, query, maxLength, onChange: value => apply.current(value) });
  }, [active, label, maxLength, query, register]);

  return active;
}
