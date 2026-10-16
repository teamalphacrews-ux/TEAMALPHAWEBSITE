// Explicit API origins take priority; production otherwise uses the same origin.
const envUrl = import.meta.env.VITE_API_URL;
const hostname = window.location.hostname;
const isLocalNetwork = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);
export const API_BASE_URL = envUrl && !envUrl.includes('your-api-slug')
  ? envUrl.replace(/\/$/, '')
  : isLocalNetwork ? window.location.protocol + '//' + hostname + ':5000' : window.location.origin;
export default API_BASE_URL;
