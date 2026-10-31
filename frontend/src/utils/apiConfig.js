// Use the page's origin by default, including Vite's local-network API proxy.
const envUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = envUrl && !envUrl.includes('your-api-slug')
  ? envUrl.replace(/\/$/, '')
  : window.location.origin;
export default API_BASE_URL;
