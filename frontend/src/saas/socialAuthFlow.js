import { signupPlanId } from './signupIntent.js';

export const SOCIAL_FLOW_KEY = 'studio-os-social-signin';
const FLOW_MAX_AGE = 10 * 60 * 1000;
export const validSocialCode = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function readSocialFlow(raw, now = Date.now()) {
  try {
    const flow = JSON.parse(raw);
    if (!validSocialCode(flow?.browserProof) || !['login', 'signup'].includes(flow.purpose) || !Number.isFinite(flow.createdAt) || flow.createdAt > now || now - flow.createdAt >= FLOW_MAX_AGE) return null;
    return { browserProof: flow.browserProof, purpose: flow.purpose, createdAt: flow.createdAt, ...(['google', 'apple'].includes(flow.provider) ? { provider: flow.provider } : {}), ...(validSocialCode(flow.ticket) ? { ticket: flow.ticket } : {}), ...(signupPlanId(flow.plan) ? { plan: flow.plan } : {}) };
  } catch { return null; }
}

export function validateWorkspaceDetails(form) {
  const values = Object.fromEntries(['studioName', 'firstName', 'lastName'].map(key => [key, String(form?.[key] || '').trim()]));
  const errors = {};
  if (values.studioName.length < 2) errors.studioName = 'Enter a studio name with at least 2 characters.';
  if (!values.firstName) errors.firstName = 'Enter the name you would like your team to see.';
  for (const key of Object.keys(values)) if (values[key].length > 120) errors[key] = 'Use 120 characters or fewer.';
  for (const key of Object.keys(values)) if (Array.from(values[key]).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) errors[key] = 'Use a single line without tabs or control characters.';
  return { values, errors };
}
export function safeAuthorizationUrl(value, provider) {
  try {
    const url = new URL(value);
    const expected = { google: ['accounts.google.com', '/o/oauth2/v2/auth'], apple: ['appleid.apple.com', '/auth/authorize'] }[provider];
    if (!expected || url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname !== expected[0] || url.pathname !== expected[1] || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export function callbackParameters(fragment) {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const messages = {
    cancelled: 'Sign-in was cancelled. You can try again whenever you’re ready.',
    expired: 'This sign-in link has expired. Please start again.',
    unavailable: 'This sign-in option is not available yet. Please try again later.',
    verification_failed: 'We could not verify this sign-in. Please start again.',
  };
  const code = params.get('error');
  if (code) return { error: messages[code] || messages.verification_failed };
  const ticket = params.get('ticket');
  return validSocialCode(ticket) ? { ticket } : {};
}

export function socialCallbackState(raw, fragment, now = Date.now()) {
  const flow = readSocialFlow(raw, now);
  const context = flow ? { purpose: flow.purpose, ...(flow.plan ? { plan: flow.plan } : {}) } : {};
  const result = callbackParameters(fragment);
  if (result.error) return { ...context, ...result };
  const ticket = result.ticket || flow?.ticket;
  if (!flow || !validSocialCode(ticket)) return {
    ...context,
    error: 'This sign-in must finish in the same tab where it started. Please start again.',
  };
  return { ...flow, ticket };
}
