import {clearLocalDrafts,draftScope} from '../offline/draftVault';
import {disconnectNativeDevice} from '../native/deviceFeatures';
import API from '../utils/apiConfig';
import { isWorkspaceSession } from './workspaceValues';
import { notifyNativeWorkspaceChanged } from '../native/nativeCapabilities';
export { workspaceId, isWorkspaceSession, roleLabel, statusLabel, safeDate, trialDaysLeft, planPrice } from './workspaceValues';

export async function saasRequest(path, { method = 'GET', body, signal, publicRequest = false } = {}) {
  const token = publicRequest ? null : localStorage.getItem('token');
  const response = await fetch(API + '/api/saas' + path, { method, signal, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.error || data?.msg || (response.status === 503 ? 'This service is not configured yet. Please try again later.' : 'We could not complete your request. Please retry.')), { status: response.status });
  if (!data || typeof data !== 'object') throw new Error('The server returned an unexpected response. Please retry.');
  return data;
}
export async function openWorkspaceSession(value) {
  if (!isWorkspaceSession(value)) throw new Error('The studio session could not be confirmed. Please sign in again.');
  let previous;try{previous=JSON.parse(localStorage.getItem('user')||'null');}catch{/* Invalid old session. */}
  const previousToken=localStorage.getItem('token');
  if(previousToken&&previousToken!==value.token){await clearLocalDrafts(draftScope(previous));await disconnectNativeDevice(previousToken);}
  localStorage.setItem('token', value.token);
  localStorage.setItem('user', JSON.stringify(value.user));
  notifyNativeWorkspaceChanged();
  // Discard all requests, records and branding from the previous studio.
  window.location.assign('/admin');
}

let razorpayScript;
export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpayScript) return razorpayScript;
  razorpayScript = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); razorpayScript = null; reject(new Error('Payment checkout took too long to load. Please retry.')); }, 20000);
    script.onload = () => { window.clearTimeout(timeout); if (window.Razorpay) resolve(window.Razorpay); else { razorpayScript = null; reject(new Error('Payment checkout could not load. Please retry.')); } };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); razorpayScript = null; reject(new Error('Payment checkout could not load. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
  return razorpayScript;
}
