const express = require('express');
const crypto = require('node:crypto');
const router = express.Router();
const models = require('./models');
const service = require('./service');
const { plans, TRIAL_DAYS, accessStatus } = require('./plans');
const { failure, validId } = require('./access');
const { runInWorkspace } = require('./tenantContext');
const billing = require('./billing');
const auth = require('../middleware/auth');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const guarded = fn => async (req, res, next) => { try { await fn(req, res, next); } catch (error) {
  if (!res.headersSent) res.status(error.status || (error.code === 11000 ? 409 : 503)).json({ msg: error.status ? error.message : error.code === 11000 ? 'This invitation or account already exists.' : 'Studio setup is temporarily unavailable. Please retry.' });
} };
const enabled = (req, res, next) => process.env.SAAS_ENABLED === 'true' ? next() : res.status(503).json({ msg: 'New studio accounts are not open yet.' });
const owner = (req, res, next) => req.saas?.membership.role === 'owner' ? next() : res.status(403).json({ msg: 'Only the studio owner can manage team access and the subscription.' });
// Bound memory and throttle credential guessing. Production ingress should also enforce a shared rate limit.
const attempts = new Map();
function authLimit(req, res, next) {
  const trustedProxy = /^[12]$/.test(process.env.SAAS_TRUST_PROXY_HOPS || '');
  const source = trustedProxy ? req.ip : req.socket.remoteAddress || 'unknown', now = Date.now();
  const email = service.emailOf(req.body?.email);
  const keys = [[`source:${source}`, 3000], ...(email ? [[`account:${digest(email)}`, 20]] : [])];
  for (const [key, limit] of keys) {
    const row = attempts.get(key);
    if (row && row.until > now && row.count >= limit) { res.set('Retry-After', String(Math.ceil((row.until - now) / 1000))); return res.status(429).json({ msg: 'Too many attempts. Please try again in a few minutes.' }); }
    if (!row || row.until <= now) attempts.set(key, { count: 1, until: now + 15 * 60000 }); else row.count++;
  }
  if (attempts.size > 10000) { for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id); if (attempts.size > 10000) attempts.delete(attempts.keys().next().value); }
  next();
}
router.use('/oauth', require('./socialRoutes').createSocialRouter({ authLimit }));
router.get('/config', (_req, res) => res.json({ authEnabled: process.env.SAAS_ENABLED === 'true', enabled: process.env.SAAS_ENABLED === 'true' && process.env.SAAS_SIGNUP_ENABLED === 'true', oauth: require('./socialAuth').publicProviderStatus(), trialDays: TRIAL_DAYS, billingProvider: 'razorpay', plans: plans() }));
router.post('/signup', enabled, authLimit, guarded(async (req, res) => {
  if (process.env.SAAS_SIGNUP_ENABLED !== 'true') throw failure(503, 'New studio registration is currently invite-only. Please contact the Studio OS team.');
  const name = service.text(req.body.studioName, 'studio name');
  const account = await service.authenticateAccount(req.body, { create: true });
  const count = await models.Membership.countDocuments({ accountId: account._id, role: 'owner', state: 'active' });
  if (count >= 5) throw failure(409, 'Contact support to create more than five studios.');
  const { workspace, membership } = await service.provisionWorkspace(account, name);
  res.status(201).json(await service.issueSession(account, workspace, membership, req));
}));
async function login(req, res, next, { legacyFallback = false } = {}) {
  if (process.env.SAAS_ENABLED !== 'true') return legacyFallback ? next() : res.status(503).json({ msg: 'Studio accounts are not open yet.' });
  const { email } = service.credentials(req.body || {});
  if (legacyFallback && !await models.Account.exists({ email })) return next();
  const account = await service.authenticateAccount(req.body);
  const filter = { accountId: account._id, state: 'active' };
  if (req.body.workspaceId !== undefined) { if (!validId(req.body.workspaceId)) throw failure(400, 'Choose a valid studio.'); filter.workspaceId = req.body.workspaceId; }
  const memberships = await models.Membership.find(filter).sort({ createdAt: 1 });
  for (const membership of memberships) {
    const workspace = await models.Workspace.findOne({ _id: membership.workspaceId, state: 'active' });
    if (workspace) return res.json(await service.issueSession(account, workspace, membership, req));
  }
  throw failure(403, 'No active studio is available for this account. Ask your studio owner for an invitation.');
}
router.post('/login', enabled, authLimit, guarded((req, res, next) => login(req, res, next)));

const validInvite = token => typeof token === 'string' && /^[a-f\d]{64}$/.test(token);
router.get('/invitations/:token', enabled, guarded(async (req, res) => {
  if (!validInvite(req.params.token)) throw failure(404, 'This invitation is unavailable or expired.');
  const invite = await models.Invitation.findOne({ tokenHash: digest(req.params.token), state: 'pending', expiresAt: { $gt: new Date() } });
  const workspace = invite && await models.Workspace.findOne({ _id: invite.workspaceId, state: 'active' });
  if (!workspace) throw failure(404, 'This invitation is unavailable or expired.');
  res.json({ studioName: workspace.name, email: invite.email, role: invite.role, expiresAt: invite.expiresAt });
}));
router.post('/invitations/:token/accept', enabled, authLimit, guarded(async (req, res) => {
  if (!validInvite(req.params.token)) throw failure(404, 'This invitation is unavailable or expired.');
  const invite = await models.Invitation.findOne({ tokenHash: digest(req.params.token), state: 'pending', expiresAt: { $gt: new Date() } });
  const workspace = invite && await models.Workspace.findOne({ _id: invite.workspaceId, state: 'active' });
  if (!workspace) throw failure(404, 'This invitation is unavailable or expired.');
  if (!['active', 'trialing'].includes(accessStatus(workspace))) throw failure(402, 'Ask the studio owner to renew the subscription before joining.');
  // The invitation supplies the email. A caller cannot change the recipient.
  const account = await service.authenticateAccount({ ...req.body, email: invite.email }, { create: true });
  const existing = await models.Membership.findOne({ workspaceId: workspace._id, accountId: account._id, state: 'active' });
  if (existing) throw failure(409, 'You already belong to this studio. Sign in to continue.');
  const claimed = await models.Invitation.findOneAndUpdate({ _id: invite._id, state: 'pending', expiresAt: { $gt: new Date() } }, { $set: { state: 'accepting', acceptingUntil: new Date(Date.now() + 120000) } }, { new: true });
  if (!claimed) throw failure(409, 'This invitation has already been used.');
  try {
    const user = await service.localMember(workspace, account, invite.role);
    const membership = await models.Membership.findOneAndUpdate({ workspaceId: workspace._id, accountId: account._id }, { $set: { localUserId: user._id, role: invite.role, state: 'active' } }, { upsert: true, new: true, runValidators: true });
    await models.Invitation.updateOne({ _id: invite._id, state: 'accepting' }, { $set: { state: 'accepted' } });
    res.json(await service.issueSession(account, workspace, membership, req));
  } catch (error) { await models.Invitation.updateOne({ _id: invite._id, state: 'accepting' }, { $set: { state: 'pending' } }); throw error; }
}));

router.post('/billing/webhook', enabled, guarded(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(req.rawBody)) throw failure(503, 'Billing webhooks are not configured.');
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  if (!billing.validSignature(req.headers['x-razorpay-signature'], expected)) throw failure(401, 'Invalid webhook signature.');
  const eventId = req.headers['x-razorpay-event-id'], subscription = req.body.payload?.subscription?.entity;
  if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(eventId) || !/^sub_[A-Za-z0-9]+$/.test(subscription?.id || '')) return res.sendStatus(200);
  if (await models.BillingEvent.exists({ _id: eventId })) return res.sendStatus(200);
  const workspace = await models.Workspace.findOne({ $or: [{ pendingSubscriptionId: subscription.id }, { razorpaySubscriptionId: subscription.id }] });
  if (workspace) await billing.refreshSubscription(workspace, subscription.id);
  try { await models.BillingEvent.create({ _id: eventId, subscriptionId: subscription.id }); } catch (error) { if (error.code !== 11000) throw error; }
  res.sendStatus(200);
}));

router.use(enabled, auth, (req, res, next) => req.saas ? next() : res.status(409).json({ msg: 'This is the existing Team Alpha account. Create a separate SaaS studio to use workspace management; existing records remain in the original studio.' }));
router.get('/workspaces', guarded(async (req, res) => {
  const memberships = await models.Membership.find({ accountId: req.saas.account._id, state: 'active' });
  const workspaces = await models.Workspace.find({ _id: { $in: memberships.map(item => item.workspaceId) }, state: 'active' });
  res.json({ workspaces: workspaces.map(item => service.workspaceView(item, memberships.find(m => String(m.workspaceId) === String(item._id)))), activeWorkspaceId: String(req.saas.workspace._id) });
}));
router.post('/workspaces', authLimit, guarded(async (req, res) => {
  if (await models.Membership.countDocuments({ accountId: req.saas.account._id, role: 'owner', state: 'active' }) >= 5) throw failure(409, 'Contact support to create more than five studios.');
  const result = await service.provisionWorkspace(req.saas.account, service.text(req.body.studioName, 'studio name'));
  res.status(201).json(await service.issueSession(req.saas.account, result.workspace, result.membership, req));
}));
router.post('/workspaces/:id/switch', guarded(async (req, res) => {
  if (!validId(req.params.id)) throw failure(404, 'Studio unavailable.');
  const membership = await models.Membership.findOne({ accountId: req.saas.account._id, workspaceId: req.params.id, state: 'active' });
  const workspace = membership && await models.Workspace.findOne({ _id: req.params.id, state: 'active' });
  if (!workspace) throw failure(404, 'Studio unavailable.');
  res.json(await service.issueSession(req.saas.account, workspace, membership, req));
}));
router.get('/workspace', guarded(async (req, res) => {
  const { workspace, membership } = req.saas;
  await service.expireInvitations(workspace._id);
  const members = await models.Membership.find({ workspaceId: workspace._id, state: 'active' });
  const accounts = await models.Account.find({ _id: { $in: members.map(item => item.accountId) } });
  const invitations = membership.role === 'owner' ? await models.Invitation.find({ workspaceId: workspace._id, state: 'pending', expiresAt: { $gt: new Date() } }) : [];
  res.json({ workspace: service.workspaceView(workspace, membership), role: membership.role,
    members: members.map(member => { const account = accounts.find(item => String(item._id) === String(member.accountId)); return { id: String(member._id), email: account?.email, firstName: account?.firstName, lastName: account?.lastName, role: member.role }; }),
    invitations: invitations.map(item => ({ id: String(item._id), email: item.email, role: item.role, expiresAt: item.expiresAt })),
    seats: { used: members.length, reserved: invitations.length, limit: workspace.seatLimit }, plans: plans(),
    billing: { provider: 'razorpay', configured: plans().some(item => item.configured) } });
}));
router.post('/invitations', owner, guarded(async (req, res) => {
  const { workspace, account } = req.saas, email = service.emailOf(req.body.email), role = req.body.role;
  let origin;
  try { origin = new URL(process.env.FRONTEND_URL); if (origin.username || origin.password || (origin.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error(); }
  catch { throw failure(503, 'Configure a valid frontend URL before sharing invitations.'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !['admin', 'staff'].includes(role)) throw failure(400, 'Enter a valid email and team role.');
  if (!['active', 'trialing'].includes(accessStatus(workspace))) throw failure(402, 'Renew your subscription before inviting team members.');
  await service.expireInvitations(workspace._id);
  const memberAccount = await models.Account.findOne({ email });
  if (memberAccount && await models.Membership.exists({ workspaceId: workspace._id, accountId: memberAccount._id, state: 'active' })) throw failure(409, 'This person is already a member.');
  const reserved = await models.Workspace.findOneAndUpdate({ _id: workspace._id, $expr: { $lt: ['$seatsReserved', '$seatLimit'] } }, { $inc: { seatsReserved: 1 } });
  if (!reserved) throw failure(409, 'Your plan has no available team seats. Cancel an invitation or upgrade your plan.');
  const token = crypto.randomBytes(32).toString('hex');
  let invite;
  try { invite = await models.Invitation.create({ workspaceId: workspace._id, email, role, tokenHash: digest(token), expiresAt: new Date(Date.now() + 7 * 86400000), invitedBy: account._id }); }
  catch (error) { await models.Workspace.updateOne({ _id: workspace._id, seatsReserved: { $gt: 0 } }, { $inc: { seatsReserved: -1 } }); throw error; }
  res.status(201).json({ invitation: { id: String(invite._id), email, role, expiresAt: invite.expiresAt }, acceptUrl: new URL('/join/' + token, origin.origin).href });
}));
router.delete('/invitations/:id', owner, guarded(async (req, res) => {
  if (!validId(req.params.id)) throw failure(404, 'Invitation unavailable.');
  const invite = await models.Invitation.findOneAndUpdate({ _id: req.params.id, workspaceId: req.saas.workspace._id, state: 'pending' }, { $set: { state: 'cancelled' } });
  if (!invite) throw failure(404, 'Invitation unavailable.');
  await models.Workspace.updateOne({ _id: req.saas.workspace._id, seatsReserved: { $gt: 0 } }, { $inc: { seatsReserved: -1 } });
  res.json({ success: true });
}));
router.patch('/members/:id', owner, guarded(async (req, res) => {
  if (!validId(req.params.id) || !['admin', 'staff', 'removed'].includes(req.body.role)) throw failure(400, 'Choose a valid member and role.');
  const member = await models.Membership.findOne({ _id: req.params.id, workspaceId: req.saas.workspace._id, state: 'active', role: { $ne: 'owner' } });
  if (!member) throw failure(404, 'This team member cannot be changed.');
  const removed = req.body.role === 'removed';
  const changed = await models.Membership.updateOne({ _id: member._id, state: 'active', role: { $ne: 'owner' } }, { $set: removed ? { state: 'removed' } : { role: req.body.role } });
  if (changed.modifiedCount) {
    await runInWorkspace(req.saas.workspace, () => require('../models/AdminSession').updateMany({ user: member.localUserId, revokedAt: null }, { $set: { revokedAt: new Date() } }));
    if (removed) await models.Workspace.updateOne({ _id: req.saas.workspace._id, seatsReserved: { $gt: 0 } }, { $inc: { seatsReserved: -1 } });
  }
  res.json({ success: true });
}));
router.post('/billing/checkout', owner, guarded(async (req, res) => {
  const workspace = req.saas.workspace, plan = await billing.approvedPlan(req.body.planId);
  if (workspace.razorpaySubscriptionId) {
    const previous = await billing.razorpay('subscriptions/' + workspace.razorpaySubscriptionId);
    if (!['cancelled', 'completed', 'expired'].includes(previous.status)) throw failure(409, 'An existing recurring subscription must be cancelled or reconciled before starting another. Contact support to change plans.');
  }
  if (workspace.seatsReserved > plan.seatLimit) throw failure(409, 'Remove extra seats before choosing this plan.');
  let subscription;
  if (workspace.pendingSubscriptionId) {
    if (workspace.pendingPlanId !== plan.id) throw failure(409, 'Complete or cancel your existing pending subscription before choosing another plan.');
    subscription = await billing.razorpay('subscriptions/' + workspace.pendingSubscriptionId);
    if (['cancelled', 'completed', 'expired'].includes(subscription.status)) {
      await models.Workspace.updateOne({ _id: workspace._id, pendingSubscriptionId: subscription.id }, { $unset: { pendingSubscriptionId: 1, pendingPlanId: 1, checkoutState: 1, checkoutRequestedAt: 1 } });
      throw failure(409, 'The previous checkout has ended and was cleared. Choose your plan again.');
    }
    if (!['created', 'authenticated'].includes(subscription.status)) throw failure(409, 'Your previous checkout is being processed. Refresh your subscription status before retrying.');
  } else {
    // Atomic lease protects repeated/concurrent checkout requests; no unbounded duplicate mandates.
    const leased = await models.Workspace.findOneAndUpdate({ _id: workspace._id, razorpaySubscriptionId: workspace.razorpaySubscriptionId || { $exists: false }, pendingSubscriptionId: { $exists: false }, checkoutState: { $exists: false } }, { $set: { checkoutState: 'creating', checkoutRequestedAt: new Date() } }, { new: true });
    if (!leased) throw failure(409, 'A subscription checkout is already being prepared. Please retry shortly.');
    try {
      subscription = await billing.razorpay('subscriptions', { method: 'POST', body: { plan_id: plan.providerId, total_count: 120, quantity: 1, customer_notify: 1, notes: { workspaceId: String(workspace._id), planId: plan.id } } });
      if (!/^sub_[A-Za-z0-9]+$/.test(subscription.id || '')) throw failure(502, 'The payment provider returned an unexpected subscription. Contact support before retrying.');
      await models.Workspace.updateOne({ _id: workspace._id }, { $set: { pendingSubscriptionId: subscription.id, pendingPlanId: plan.id, checkoutState: 'pending' } });
    } catch (error) {
      // An ambiguous provider timeout must be reconciled before another mandate is created.
      await models.Workspace.updateOne({ _id: workspace._id }, { $set: { checkoutState: 'reconcile' } }).catch(() => {});
      throw error;
    }
  }
  res.json({ subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID, studioName: workspace.name, email: req.saas.account.email,
    monthlyAmount: plan.monthlyAmount, currency: 'INR', billingCycles: 120 });
}));
router.post('/billing/verify', owner, guarded(async (req, res) => {
  const { razorpay_subscription_id: subscriptionId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId || '') || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId || '') || !process.env.RAZORPAY_KEY_SECRET || !billing.validSignature(signature, billing.paymentSignature(paymentId, subscriptionId, process.env.RAZORPAY_KEY_SECRET))) throw failure(400, 'Payment verification failed. Refresh your plan before attempting another payment.');
  res.json(await billing.refreshSubscription(req.saas.workspace, subscriptionId));
}));
module.exports = router;
module.exports.legacyLogin = guarded((req, res, next) => login(req, res, next, { legacyFallback: true }));
module.exports.authLimit = authLimit;
