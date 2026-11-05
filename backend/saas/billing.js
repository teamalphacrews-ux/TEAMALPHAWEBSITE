const crypto = require('node:crypto');
const { failure } = require('./access');
const { plans } = require('./plans');
function validSignature(value, expected) {
  return typeof value === 'string' && /^[a-f\d]{64}$/i.test(value) && crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex'));
}
function paymentSignature(paymentId, subscriptionId, secret) {
  return crypto.createHmac('sha256', secret).update(paymentId + '|' + subscriptionId).digest('hex');
}
async function razorpay(path, { method = 'GET', body, env = process.env, fetchImpl = fetch } = {}) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw failure(503, 'Razorpay subscriptions have not been configured.');
  const response = await fetchImpl('https://api.razorpay.com/v1/' + path, { method, headers: {
    Authorization: 'Basic ' + Buffer.from(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET).toString('base64'), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw failure(502, 'The payment provider could not complete this request. Please retry.');
  return data;
}
async function approvedPlan(planId, env = process.env) {
  const plan = plans(env).find(item => item.id === planId);
  if (!plan?.configured) throw failure(503, 'Monthly pricing is awaiting configuration and approval.');
  const providerId = env[`RAZORPAY_${plan.id.toUpperCase()}_PLAN_ID`];
  const remote = await razorpay('plans/' + encodeURIComponent(providerId), { env });
  if (remote.id !== providerId || remote.period !== 'monthly' || remote.interval !== 1 || remote.item?.currency !== 'INR' || remote.item?.amount !== plan.monthlyAmount * 100)
    throw failure(503, 'The configured Razorpay plan does not match the approved monthly price.');
  return { ...plan, providerId };
}
async function reconcileSubscription(workspace, subscriptionId, { models, env, leaseToken }) {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId || '')) throw failure(400, 'Subscription is not valid.');
  if (![workspace.pendingSubscriptionId, workspace.razorpaySubscriptionId].includes(subscriptionId)) throw failure(403, 'This subscription does not belong to your studio.');
  const subscription = await razorpay('subscriptions/' + subscriptionId, { env });
  const planId = subscriptionId === workspace.pendingSubscriptionId ? workspace.pendingPlanId : workspace.planId;
  const plan = await approvedPlan(planId, env);
  if (subscription.id !== subscriptionId || subscription.plan_id !== plan.providerId || subscription.notes?.workspaceId !== String(workspace._id)) throw failure(403, 'The subscription could not be matched to this studio.');
  if (plan.seatLimit < workspace.seatsReserved) throw failure(409, 'Remove extra team seats before changing to this plan.');
  const patch = subscription.status === 'active'
    ? { planId, seatLimit: plan.seatLimit, razorpaySubscriptionId: subscriptionId, razorpayPlanId: plan.providerId, subscriptionStatus: 'active' }
    : ['halted', 'paused'].includes(subscription.status) ? { subscriptionStatus: 'past_due' }
    : ['cancelled', 'completed', 'expired'].includes(subscription.status) && subscriptionId === workspace.razorpaySubscriptionId ? { subscriptionStatus: 'cancelled' } : {};
  if (Object.keys(patch).length) {
    const update = { $set: patch };
    if (subscriptionId === workspace.pendingSubscriptionId && (subscription.status === 'active' || ['cancelled', 'completed', 'expired'].includes(subscription.status))) update.$unset = { pendingSubscriptionId: 1, pendingPlanId: 1, checkoutState: 1, checkoutRequestedAt: 1 };
    const result = await models.Workspace.updateOne({ _id: workspace._id, billingSyncToken: leaseToken, ...(patch.seatLimit ? { seatsReserved: { $lte: patch.seatLimit } } : {}),
      $or: [{ pendingSubscriptionId: subscriptionId }, { razorpaySubscriptionId: subscriptionId }] }, update);
    if (!result.matchedCount) throw failure(409, 'The studio plan or seat usage changed. Refresh before continuing.');
  }
  return { status: 'verified', subscriptionStatus: patch.subscriptionStatus || workspace.subscriptionStatus };
}
async function refreshSubscription(workspace, subscriptionId, { models = require('./models'), env = process.env } = {}) {
  const leaseToken = crypto.randomBytes(24).toString('hex');
  const latest = await models.Workspace.findOneAndUpdate({ _id: workspace._id, $or: [{ billingSyncUntil: { $exists: false } }, { billingSyncUntil: { $lt: new Date() } }] },
    { $set: { billingSyncToken: leaseToken, billingSyncUntil: new Date(Date.now() + 150000) } }, { new: true });
  if (!latest) throw failure(409, 'Subscription status is already being refreshed. Please retry shortly.');
  try { return await reconcileSubscription(latest, subscriptionId, { models, env, leaseToken }); }
  finally { await models.Workspace.updateOne({ _id: workspace._id, billingSyncToken: leaseToken }, { $unset: { billingSyncToken: 1, billingSyncUntil: 1 } }); }
}
module.exports = { validSignature, paymentSignature, razorpay, approvedPlan, refreshSubscription };
