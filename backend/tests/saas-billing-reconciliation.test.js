const test = require('node:test');
const assert = require('node:assert/strict');
const Mongoose = require('mongoose');
const { refreshSubscription } = require('../saas/billing');
const { installTenantModels } = require('../saas/tenantModels');
const { runInWorkspace } = require('../saas/tenantContext');

const workspaceId = 'a'.repeat(24), subscriptionId = 'sub_expected', providerPlanId = 'plan_StudioMonthly';
const env = Object.freeze({ RAZORPAY_KEY_ID: 'rzp_test_only', RAZORPAY_KEY_SECRET: 'test-secret-not-a-credential', SAAS_STUDIO_MONTHLY_INR: '2500', RAZORPAY_STUDIO_PLAN_ID: providerPlanId });
const workspace = () => ({ _id: workspaceId, pendingSubscriptionId: subscriptionId, pendingPlanId: 'studio', planId: 'starter', subscriptionStatus: 'trialing', seatsReserved: 3 });
const providerSubscription = () => ({ id: subscriptionId, plan_id: providerPlanId, notes: { workspaceId }, status: 'active' });
const providerPlan = () => ({ id: providerPlanId, period: 'monthly', interval: 1, item: { currency: 'INR', amount: 250000 } });

function fixture(t, options = {}) {
  const state = { fetches: [], leases: [], updates: [], leaseToken: null };
  const row = { ...workspace(), ...options.workspace };
  const originalFetch = global.fetch;
  global.fetch = async (url, request) => {
    state.fetches.push({ url, request });
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.Authorization, 'Basic ' + Buffer.from(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET).toString('base64'));
    let data;
    if (url === 'https://api.razorpay.com/v1/subscriptions/' + subscriptionId) data = options.subscription || providerSubscription();
    else if (url === 'https://api.razorpay.com/v1/plans/' + providerPlanId) data = options.plan || providerPlan();
    else assert.fail('Unexpected provider request: ' + url);
    return { ok: true, json: async () => data };
  };
  t.after(() => { global.fetch = originalFetch; });
  const models = { Workspace: {
    async findOneAndUpdate(filter, update, settings) {
      state.leases.push({ filter, update, settings });
      assert.equal(filter._id, workspaceId);
      assert.equal(settings.new, true);
      assert.equal(filter.$or[0].billingSyncUntil.$exists, false);
      assert.ok(filter.$or[1].billingSyncUntil.$lt instanceof Date);
      assert.match(update.$set.billingSyncToken, /^[a-f0-9]{48}$/);
      assert.ok(update.$set.billingSyncUntil.getTime() > Date.now() + 100000);
      state.leaseToken = update.$set.billingSyncToken;
      return options.contended ? null : { ...row, ...update.$set };
    },
    async updateOne(filter, update) {
      state.updates.push({ filter, update });
      assert.equal(filter._id, workspaceId);
      assert.equal(filter.billingSyncToken, state.leaseToken, 'Every reconciliation write and cleanup must own its lease');
      return { matchedCount: update.$set && options.staleLease ? 0 : 1 };
    },
  } };
  return { row, state, models, refresh: (id = subscriptionId) => refreshSubscription(row, id, { models, env }) };
}

function assertReleased(state) {
  assert.deepEqual(state.updates.at(-1), {
    filter: { _id: workspaceId, billingSyncToken: state.leaseToken },
    update: { $unset: { billingSyncToken: 1, billingSyncUntil: 1 } },
  });
}

test('verified active monthly subscription activates the exact workspace and clears its matching checkout', async t => {
  const { refresh, state } = fixture(t);
  assert.deepEqual(await refresh(), { status: 'verified', subscriptionStatus: 'active' });
  assert.deepEqual(state.fetches.map(call => call.url), ['https://api.razorpay.com/v1/subscriptions/' + subscriptionId, 'https://api.razorpay.com/v1/plans/' + providerPlanId]);
  assert.equal(state.updates.length, 2);
  const activation = state.updates[0];
  assert.deepEqual(activation.filter, { _id: workspaceId, billingSyncToken: state.leaseToken, seatsReserved: { $lte: 15 }, $or: [{ pendingSubscriptionId: subscriptionId }, { razorpaySubscriptionId: subscriptionId }] });
  assert.deepEqual(activation.update, {
    $set: { planId: 'studio', seatLimit: 15, razorpaySubscriptionId: subscriptionId, razorpayPlanId: providerPlanId, subscriptionStatus: 'active' },
    $unset: { pendingSubscriptionId: 1, pendingPlanId: 1, checkoutState: 1, checkoutRequestedAt: 1 },
  });
  assertReleased(state);
});

test('refreshing the current active subscription preserves a different pending checkout', async t => {
  const { refresh, state } = fixture(t, { workspace: { planId: 'studio', razorpaySubscriptionId: subscriptionId, pendingSubscriptionId: 'sub_replacement', pendingPlanId: 'scale' } });
  await refresh();
  assert.equal(state.updates[0].update.$set.razorpaySubscriptionId, subscriptionId);
  assert.equal(state.updates[0].update.$unset, undefined);
  assertReleased(state);
});

for (const [name, changed] of [
  ['another workspace note', { notes: { workspaceId: 'b'.repeat(24) } }],
  ['a missing workspace note', { notes: {} }],
  ['another subscription identity', { id: 'sub_foreign' }],
  ['another provider plan', { plan_id: 'plan_Foreign' }],
]) test('billing refuses activation for ' + name, async t => {
  const { refresh, state } = fixture(t, { subscription: { ...providerSubscription(), ...changed } });
  await assert.rejects(refresh(), error => error.status === 403);
  assert.equal(state.updates.some(call => call.update.$set), false);
  assertReleased(state);
});

for (const [name, changed] of [
  ['a different amount', { item: { currency: 'INR', amount: 249900 } }],
  ['a different currency', { item: { currency: 'USD', amount: 250000 } }],
  ['an annual period', { period: 'yearly' }],
  ['a multi-month interval', { interval: 3 }],
  ['another plan identity', { id: 'plan_Foreign' }],
]) test('provider plan approval rejects ' + name, async t => {
  const { refresh, state } = fixture(t, { plan: { ...providerPlan(), ...changed } });
  await assert.rejects(refresh(), error => error.status === 503);
  assert.equal(state.updates.some(call => call.update.$set), false);
  assertReleased(state);
});

test('an unowned subscription is rejected before any provider lookup', async t => {
  const { refresh, state } = fixture(t);
  await assert.rejects(refresh('sub_foreign'), error => error.status === 403);
  assert.equal(state.fetches.length, 0);
  assert.equal(state.updates.some(call => call.update.$set), false);
  assertReleased(state);
});

test('a checkout awaiting provider activation cannot activate seats or clear pending fields', async t => {
  const { refresh, state } = fixture(t, { subscription: { ...providerSubscription(), status: 'authenticated' } });
  assert.deepEqual(await refresh(), { status: 'verified', subscriptionStatus: 'trialing' });
  assert.equal(state.updates.length, 1, 'Only the owned lease is released; checkout stays pending');
  assertReleased(state);
});

test('an approved subscription cannot downgrade below the seats already reserved', async t => {
  const { refresh, state } = fixture(t, { workspace: { seatsReserved: 16 } });
  await assert.rejects(refresh(), error => error.status === 409);
  assert.equal(state.updates.some(call => call.update.$set), false);
  assertReleased(state);
});

test('lease contention returns conflict without contacting the provider or releasing another lease', async t => {
  const { refresh, state } = fixture(t, { contended: true });
  await assert.rejects(refresh(), error => error.status === 409);
  assert.equal(state.fetches.length, 0);
  assert.equal(state.updates.length, 0);
});

test('a stale activation lease or changed seat usage cannot report successful activation', async t => {
  const { refresh, state } = fixture(t, { staleLease: true });
  await assert.rejects(refresh(), error => error.status === 409);
  assert.equal(state.updates[0].filter.billingSyncToken, state.leaseToken);
  assert.deepEqual(state.updates[0].filter.seatsReserved, { $lte: 15 });
  assert.equal(state.updates[0].update.$set.subscriptionStatus, 'active');
  assertReleased(state);
});

test('billing event deduplication remains global and is never copied into a studio database', () => {
  const mongoose = new Mongoose.Mongoose({ autoIndex: false, autoCreate: false, bufferCommands: false });
  mongoose.connection.name = 'control_plane';
  installTenantModels(mongoose);
  const BillingEvent = mongoose.connection.model('SaaSBillingEvent', new mongoose.Schema({ _id: String }));
  const Business = mongoose.model('BillingTestBusiness', new mongoose.Schema({ name: String }));
  runInWorkspace({ _id: workspaceId, databaseName: 'studio_' + workspaceId }, () => {
    const connection = Business.find().model.db;
    assert.equal(connection.name, 'studio_' + workspaceId);
    assert.equal(connection.models.SaaSBillingEvent, undefined);
    assert.equal(mongoose.models.SaaSBillingEvent, BillingEvent);
    assert.equal(mongoose.models.SaaSBillingEvent.find().model.db.name, 'control_plane');
  });
});
