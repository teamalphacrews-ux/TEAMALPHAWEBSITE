export const SIGNUP_PLAN_KEY = 'studio-x-os-signup-plan';
export const SIGNUP_PLAN_NAMES = Object.freeze({ starter: 'Starter', studio: 'Studio', scale: 'Scale' });
const INTENT_MAX_AGE = 24 * 60 * 60 * 1000;

export const signupPlanId = value => typeof value === 'string' && Object.hasOwn(SIGNUP_PLAN_NAMES, value) ? value : null;

export function readSignupPlan(search = '', saved = null, now = Date.now()) {
  const params = new URLSearchParams(search);
  if (params.has('plan')) return signupPlanId(params.get('plan')) || 'starter';
  try {
    const intent = JSON.parse(saved);
    if (signupPlanId(intent?.plan) && Number.isFinite(intent.createdAt)
      && intent.createdAt <= now && now - intent.createdAt <= INTENT_MAX_AGE) return intent.plan;
  } catch { /* An unavailable or expired preference starts at Starter. */ }
  return 'starter';
}

export function signupHref(plan) {
  return '/signup?plan=' + (signupPlanId(plan) || 'starter');
}

export function retainSignupPlan(storage, plan, now = Date.now()) {
  if (!signupPlanId(plan)) return;
  try { storage.setItem(SIGNUP_PLAN_KEY, JSON.stringify({ plan, createdAt: now })); }
  catch { /* The URL still preserves the choice when browser storage is blocked. */ }
}
