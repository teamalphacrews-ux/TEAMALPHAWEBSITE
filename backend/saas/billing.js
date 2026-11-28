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
async function approvedPlan(planId, env = process.env, recorded = {}) {
  const plan = plans(env).find(item => item.id === planId);
  if (!plan || (!recorded.providerId && !plan.configured)) throw failure(503, 'Monthly pricing is awaiting configuration and approval.');
  const providerId = recorded.providerId || env[`RAZORPAY_${plan.id.toUpperCase()}_PLAN_ID`];
  if (!/^plan_[A-Za-z0-9]+$/.test(providerId || '')) throw failure(503, 'The saved Razorpay plan requires review.');
  const expectedPaise = recorded.providerId ? recorded.amountPaise : plan.monthlyAmount * 100;
  const remote = await razorpay('plans/' + encodeURIComponent(providerId), { env });
  const amount = remote.item?.amount;
  // Older active subscriptions stored the verified plan ID only. Razorpay plans are immutable.
  if (remote.id !== providerId || remote.period !== 'monthly' || remote.interval !== 1 ||
      remote.item?.currency !== 'INR' || !Number.isSafeInteger(amount) || amount <= 0 || amount % 100 !== 0 ||
      (expectedPaise != null && amount !== expectedPaise))
    throw failure(503, 'The configured Razorpay plan does not match the approved monthly price.');
  return { ...plan, providerId, monthlyAmount: amount / 100 };
}
function pendingPlanApproval(workspace) {
  const providerId = workspace.pendingSubscriptionId && workspace.pendingRazorpayPlanId;
  const amountPaise = workspace.pendingRazorpayPlanAmountPaise;
  if (providerId && (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise % 100 !== 0)) {
    throw failure(503, 'The saved Razorpay checkout price requires review.');
  }
  return providerId ? { providerId, amountPaise } : {};
}
const pendingCheckoutFields = {
  pendingSubscriptionId: 1, pendingPlanId: 1, pendingRazorpayPlanId: 1, pendingRazorpayPlanAmountPaise: 1,
  checkoutState: 1, checkoutRequestedAt: 1,
};
function matchesSubscription(subscription, subscriptionId, providerId, workspaceId) {
  return subscription.id === subscriptionId && subscription.plan_id === providerId && subscription.notes?.workspaceId === String(workspaceId);
}
async function reconcileSubscription(workspace, subscriptionId, { models, env, leaseToken }) {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId || '')) throw failure(400, 'Subscription is not valid.');
  const isPending = subscriptionId === workspace.pendingSubscriptionId;
  const isCurrent = subscriptionId === workspace.razorpaySubscriptionId;
  if (!isPending && !isCurrent) throw failure(403, 'This subscription does not belong to your studio.');
  const subscription = await razorpay('subscriptions/' + subscriptionId, { env });
  const planId = isPending ? workspace.pendingPlanId : workspace.planId;
  const recorded = isPending ? pendingPlanApproval(workspace)
    : { providerId: workspace.razorpayPlanId, amountPaise: workspace.razorpayPlanAmountPaise };
  const plan = await approvedPlan(planId, env, recorded);
  if (!matchesSubscription(subscription, subscriptionId, plan.providerId, workspace._id)) throw failure(403, 'The subscription could not be matched to this studio.');
  const active = subscription.status === 'active';
  const ended = ['cancelled', 'completed', 'expired'].includes(subscription.status);
  const update = {};
  const filter = { _id: workspace._id, billingSyncToken: leaseToken,
    [isPending ? 'pendingSubscriptionId' : 'razorpaySubscriptionId']: subscriptionId };
  if (active) {
    if (plan.seatLimit < workspace.seatsReserved) throw failure(409, 'Remove extra team seats before changing to this plan.');
    filter.seatsReserved = { $lte: plan.seatLimit };
    update.$set = { planId, seatLimit: plan.seatLimit, razorpaySubscriptionId: subscriptionId,
      razorpayPlanId: plan.providerId, razorpayPlanAmountPaise: plan.monthlyAmount * 100, subscriptionStatus: 'active' };
  } else if (isCurrent && ended) {
    update.$set = { subscriptionStatus: 'cancelled' };
  } else if (isCurrent && ['halted', 'paused'].includes(subscription.status)) {
    update.$set = { subscriptionStatus: 'past_due' };
  }
  if (isPending && (active || ended)) {
    update.$unset = pendingCheckoutFields;
  }
  if (update.$set || update.$unset) {
    const result = await models.Workspace.updateOne(filter, update);
    if (!result.matchedCount) throw failure(409, 'The studio plan or seat usage changed. Refresh before continuing.');
  }
  return { status: 'verified', subscriptionStatus: update.$set?.subscriptionStatus || workspace.subscriptionStatus };
}
async function refreshSubscription(workspace, subscriptionId, { models = require('./models'), env = process.env } = {}) {
  const leaseToken = crypto.randomBytes(24).toString('hex');
  const latest = await models.Workspace.findOneAndUpdate({ _id: workspace._id, $or: [{ billingSyncUntil: { $exists: false } }, { billingSyncUntil: { $lt: new Date() } }] },
    { $set: { billingSyncToken: leaseToken, billingSyncUntil: new Date(Date.now() + 150000) } }, { new: true });
  if (!latest) throw failure(409, 'Subscription status is already being refreshed. Please retry shortly.');
  try { return await reconcileSubscription(latest, subscriptionId, { models, env, leaseToken }); }
  finally { await models.Workspace.updateOne({ _id: workspace._id, billingSyncToken: leaseToken }, { $unset: { billingSyncToken: 1, billingSyncUntil: 1 } }); }
}
module.exports = { validSignature, paymentSignature, razorpay, approvedPlan, refreshSubscription,
  pendingPlanApproval, pendingCheckoutFields, matchesSubscription };
