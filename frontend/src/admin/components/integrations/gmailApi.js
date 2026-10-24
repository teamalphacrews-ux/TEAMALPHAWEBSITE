import axios from 'axios';
import API_BASE_URL from '../../../utils/apiConfig';

export const gmailRequest = async (method, path, { params, signal } = {}) => (await axios({ method,
  url: API_BASE_URL + '/api/integrations/gmail' + path,
  headers: { 'x-auth-token': localStorage.getItem('token') || '' }, params, signal,
})).data;

export const gmailError = error => typeof error?.response?.data?.message === 'string'
  ? error.response.data.message : 'Email could not be loaded. Please try again.';

export function gmailHandoff(result, apiBase = API_BASE_URL, pageOrigin = window.location.origin) {
  const failure = () => new Error('Gmail connection could not be opened. Please try again.');
  if (typeof result?.url !== 'string' || result.url.length > 2048) throw failure();
  let target, api, page;
  try { target = new URL(result.url); api = new URL(apiBase || pageOrigin, pageOrigin); page = new URL(pageOrigin); } catch { throw failure(); }
  const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const localProxy = local(target) && local(api) && local(page);
  if ((!localProxy && target.origin !== api.origin) || target.pathname !== '/api/integrations/gmail/begin' ||
    target.username || target.password || target.hash || (target.protocol !== 'https:' && !(target.protocol === 'http:' && local(target))) ||
    [...target.searchParams.keys()].length !== 1 || !/^[a-f0-9]{64}$/.test(target.searchParams.get('ticket') || '')) throw failure();
  return target.href;
}
