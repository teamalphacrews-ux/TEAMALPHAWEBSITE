import { useEffect, useState } from 'react';
import axios from 'axios';
import API from './apiConfig';
import { TEAM_ALPHA_LOGO, STUDIO_X_MARK } from './branding';
import { useAuth } from '../context/AuthContext';
import { resolveProfileImage } from './studioProfileImage';

export const studioImageUrl = value => resolveProfileImage(value, API) || TEAM_ALPHA_LOGO;
export const studioImageFallback = event => {
  if (event.currentTarget.getAttribute('src') !== TEAM_ALPHA_LOGO) event.currentTarget.src = TEAM_ALPHA_LOGO;
};
export const whatsappContactUrl = (number, message = '') => {
  const digits = String(number || '').replace(/\D/g, '');
  return /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}${message ? '?text=' + encodeURIComponent(message) : ''}` : '';
};
export function useStudioIdentity() {
  const { user } = useAuth();
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));
  useEffect(() => {
    const controller = new AbortController();
    const changed = event => { setIdentity(event.detail); setLoading(false); };
    window.addEventListener('studio-settings-updated', changed);
    const token = localStorage.getItem('token');
    if (token) axios.get(API + '/api/studio/settings', { signal: controller.signal, headers: { Authorization: 'Bearer ' + token } }).then(result => setIdentity(result.data)).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); window.removeEventListener('studio-settings-updated', changed); };
  }, []);
  return { name: identity?.studioName || user?.workspace?.name || 'Team Alpha', photo: studioImageUrl(identity?.profilePhotoUrl || identity?.logoUrl || (user?.workspace ? STUDIO_X_MARK : '')), identity, loading };
}
