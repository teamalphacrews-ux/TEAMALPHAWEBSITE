import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();
const cleanToken = raw => {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return cleaned && cleaned !== 'null' && cleaned !== 'undefined' ? cleaned : null;
};
const readStoredSession = () => {
  try {
    const rawToken = localStorage.getItem('token');
    const token = cleanToken(rawToken);
    if (token && rawToken !== token) localStorage.setItem('token', token);
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return token && user && typeof user === 'object' ? { token, user } : { token: null, user: null };
  } catch { return { token: null, user: null }; }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readStoredSession);
  const navigate = useNavigate();
  const login = useCallback((user, userToken) => {
    const token = cleanToken(userToken);
    if (!token || !user) return;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setSession({ token, user });
    navigate(user.role === 'admin' ? '/admin' : '/portal');
  }, [navigate]);
  const logout = useCallback(() => {
    Object.keys(localStorage).forEach(key => { if (key.startsWith('gallery_unlocked_')) localStorage.removeItem(key); });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession({ user: null, token: null });
    navigate('/auth');
  }, [navigate]);
  const updateUser = useCallback(userData => {
    setSession(current => {
      const user = { ...current.user, ...userData };
      localStorage.setItem('user', JSON.stringify(user));
      return { ...current, user };
    });
  }, []);
  const value = useMemo(() => ({ ...session, loading: false, login, logout, updateUser }), [session, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
// eslint-disable-next-line react-refresh/only-export-components -- Preserve the existing provider and consumer-hook import API.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
