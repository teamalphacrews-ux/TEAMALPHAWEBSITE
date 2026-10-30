const TRIAL_DAYS = 14;
function plans(env = process.env) {
  return [
    { id: 'starter', name: 'Starter', seatLimit: 5, features: ['Client enquiries and projects', 'Quotes, invoices and smart links', 'Calendar and production tracking'] },
    { id: 'studio', name: 'Studio', seatLimit: 15, features: ['Everything in Starter', 'Up to 15 team members', 'More room for a growing studio'] },
    { id: 'scale', name: 'Scale', seatLimit: 50, features: ['Everything in Studio', 'Up to 50 team members', 'For studios with several teams'] },
  ].map(plan => {
    const amount = Number(env[`SAAS_${plan.id.toUpperCase()}_MONTHLY_INR`]);
    const planId = env[`RAZORPAY_${plan.id.toUpperCase()}_PLAN_ID`];
    return { ...plan, currency: 'INR', monthlyAmount: Number.isSafeInteger(amount) && amount > 0 ? amount : null,
      configured: !!(Number.isSafeInteger(amount * 100) && amount > 0 && /^plan_[A-Za-z0-9]+$/.test(planId || '') && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    };
  });
}
function accessStatus(workspace, now = Date.now()) {
  if (workspace.state !== 'active') return 'suspended';
  if (workspace.subscriptionStatus === 'active') return 'active';
  if (workspace.subscriptionStatus === 'trialing' && new Date(workspace.trialEndsAt).getTime() > now) return 'trialing';
  return 'read_only';
}
module.exports = { plans, TRIAL_DAYS, accessStatus };
