import { useEffect, useState } from 'react';
import axios from 'axios';
import API from './apiConfig';
import { TEAM_ALPHA_LOGO } from './branding';

export const studioImageUrl = value => /^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(value || '') ? API + value : value || TEAM_ALPHA_LOGO;
export const whatsappContactUrl = (number, message = '') => {
  const digits = String(number || '').replace(/\D/g, '');
  return /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}${message ? '?text=' + encodeURIComponent(message) : ''}` : '';
};
export function useStudioIdentity() {
  const [identity, setIdentity] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const changed = event => setIdentity(event.detail);
    window.addEventListener('studio-settings-updated', changed);
    const token = localStorage.getItem('token');
    if (token) axios.get(API + '/api/studio/settings', { signal: controller.signal, headers: { Authorization: 'Bearer ' + token } }).then(result => setIdentity(result.data)).catch(() => {});
    return () => { controller.abort(); window.removeEventListener('studio-settings-updated', changed); };
  }, []);
  return { name: identity?.studioName || 'Team Alpha', photo: studioImageUrl(identity?.profilePhotoUrl || identity?.logoUrl), identity };
}
