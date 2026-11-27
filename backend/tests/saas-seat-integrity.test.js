const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');

// Opt in with a disposable loopback replica set. All records go into fresh databases.
test('SaaS onboarding, seat changes and subscription webhooks preserve committed state on retries', {
  skip: !process.env.STUDIO_AUDIT_MONGO_PORT && 'Requires a disposable local Mongo replica set',
}, async t => {
  const port = Number(process.env.STUDIO_AUDIT_MONGO_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const mongoose = require('mongoose');
  const controlDatabase = 'audit_seats_' + crypto.randomBytes(8).toString('hex');
  const express = require('express');
  Object.assign(process.env, { SAAS_ENABLED: 'true', SAAS_SIGNUP_ENABLED: 'true',
    FRONTEND_URL: 'http://localhost', JWT_SECRET: crypto.randomBytes(32).toString('hex') });
  require('../saas/tenantModels').installTenantModels(mongoose);
  const models = require('../saas/models');
  const routes = require('../saas/routes');
  const { createWorkspaceMiddleware } = require('../saas/access');
  const service = require('../saas/service');
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes; } }), createWorkspaceMiddleware({ models }));
  app.use('/api/saas', routes);
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/' + controlDatabase,
    { directConnection: true, serverSelectionTimeoutMS: 3000 });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let tenant;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (tenant) await mongoose.connection.useDb(tenant, { useCache: true }).dropDatabase();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const api = async (path, method, body, token) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/saas/' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const signup = await api('signup', 'POST', { firstName: 'Test', lastName: 'Owner', studioName: 'Fixture',
    email: 'owner@example.test', password: 'fixture-password-owner' });
  assert.equal(signup.status, 201, signup.data.msg);
  const token = signup.data.token;
  const workspaceId = signup.data.user.workspace.id;
  tenant = 'studio_' + workspaceId;
  const setup = await api('setup', 'GET', undefined, token);
  assert.equal(setup.status, 200, setup.data.msg);
  for (const step of [1, 2]) {
    const saved = await api('setup', 'PATCH', { step, details: {} }, token);
    assert.equal(saved.status, 200, saved.data.msg);
  }
  const finished = await api('setup/complete', 'POST', { details: {} }, token);
  assert.equal(finished.status, 200, finished.data.msg);
  await models.Workspace.updateOne({ _id: workspaceId }, { $set: { seatLimit: 2 } });
  const seats = async () => (await models.Workspace.findById(workspaceId)).seatsReserved;
  const invite = email => api('invitations', 'POST', { email, role: 'staff' }, token);
  const pair = await Promise.all([invite('one@example.test'), invite('two@example.test')]);
  assert.deepEqual(pair.map(r => r.status).sort(), [201, 409]);
  assert.equal(await seats(), 2);
  const id = pair.find(r => r.status === 201).data.invitation.id;
  const cancel = () => api('invitations/' + id, 'DELETE', undefined, token);
  const release = t.mock.method(models.Workspace, 'updateOne', async () => { throw new Error('Synthetic storage failure'); });
  const failed = await cancel();
  release.mock.restore();
  assert.equal(failed.status, 503);
  assert.equal((await models.Invitation.findById(id)).state, 'pending');
  assert.equal(await seats(), 2);
  assert.equal((await cancel()).status, 200);
  assert.equal((await cancel()).status, 404);
  assert.equal(await seats(), 1);
  const stale = await invite('expired@example.test');
  assert.equal(stale.status, 201, stale.data.msg);
  await models.Invitation.updateOne({ _id: stale.data.invitation.id }, { $set: { expiresAt: new Date(0) } });
  await Promise.all([service.expireInvitations(workspaceId), service.expireInvitations(workspaceId)]);
  assert.equal(await seats(), 1);
  const joining = await invite('staff@example.test');
  assert.equal(joining.status, 201, joining.data.msg);
  const inviteToken = new URL(joining.data.acceptUrl).pathname.split('/').at(-1);
  const join = await api('invitations/' + inviteToken + '/accept', 'POST', { firstName: 'Test', lastName: 'Staff', password: 'fixture-password-staff' });
  assert.equal(join.status, 200, join.data.msg);
  assert.equal((await models.Invitation.findById(joining.data.invitation.id)).state, 'accepted');
  assert.equal(await seats(), 2);
  const member = await models.Membership.findOne({ workspaceId, role: 'staff' });
  const removed = await api('members/' + member._id, 'PATCH', { role: 'removed' }, token);
  assert.equal(removed.status, 200, removed.data.msg);
  assert.equal(await seats(), 1);
  assert.equal((await api('workspace', 'GET', undefined, join.data.token)).status, 401);

  const subscriptionId = 'sub_Fixture', planId = 'plan_Fixture';
  Object.assign(process.env, { SAAS_STUDIO_MONTHLY_INR: '2500', RAZORPAY_STUDIO_PLAN_ID: planId,
    RAZORPAY_KEY_ID: 'fixture', RAZORPAY_KEY_SECRET: 'fixture-only', RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook' });
  const originalFetch = global.fetch;
  let providerStatus = 'active', providerReads = 0;
  t.mock.method(global, 'fetch', (url, options) => {
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(url, options);
    assert.equal(options.method, 'GET');
    providerReads++;
    if (url === 'https://api.razorpay.com/v1/subscriptions/' + subscriptionId) {
      return Response.json({ id: subscriptionId, status: providerStatus, plan_id: planId, notes: { workspaceId } });
    }
    assert.equal(url, 'https://api.razorpay.com/v1/plans/' + planId);
    return Response.json({ id: planId, period: 'monthly', interval: 1, item: { currency: 'INR', amount: 250000 } });
  });
  const event = (eventId, reportedStatus) => {
    const body = JSON.stringify({ payload: { subscription: { entity: { id: subscriptionId, status: reportedStatus, notes: { workspaceId } } } } });
    return fetch('http://127.0.0.1:' + server.address().port + '/api/saas/billing/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-event-id': eventId,
        'x-razorpay-signature': crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex') },
      body,
    });
  };
  await models.Workspace.updateOne({ _id: workspaceId }, { $set: { checkoutState: 'creating' } });
  assert.equal((await event('fixture-first', 'paused')).status, 503);
  assert.equal(await models.BillingEvent.exists({ _id: 'fixture-first' }), null);
  assert.equal(providerReads, 0);
  await models.Workspace.updateOne({ _id: workspaceId }, { $set: { pendingSubscriptionId: subscriptionId, pendingPlanId: 'studio', checkoutState: 'pending' } });
  assert.equal((await event('fixture-first', 'paused')).status, 200);
  let synced = await models.Workspace.findById(workspaceId);
  assert.equal(synced.subscriptionStatus, 'active');
  assert.equal(synced.seatLimit, 15);
  const reads = providerReads;
  assert.equal((await event('fixture-first', 'paused')).status, 200);
  assert.equal(providerReads, reads);
  providerStatus = 'cancelled';
  assert.equal((await event('fixture-delayed', 'active')).status, 200);
  synced = await models.Workspace.findById(workspaceId);
  assert.equal(synced.subscriptionStatus, 'cancelled');
  assert.equal((await invite('renew@example.test')).status, 402);
  assert.equal(await models.BillingEvent.countDocuments({}), 2);
  const { reconcileWorkspaceSeats } = require('../scripts/reconcileWorkspaceSeats');
  await models.Workspace.updateOne({ _id: workspaceId }, { $set: { seatsReserved: 3 } });
  const dry = await reconcileWorkspaceSeats(workspaceId);
  assert.deepEqual(dry, { previous: 3, expected: 1, members: 1, pending: 0, applied: false });
  assert.equal(await seats(), 3);
  const repaired = await reconcileWorkspaceSeats(workspaceId, { apply: true });
  assert.equal(repaired.applied, true);
  assert.equal(await seats(), 1);
  assert.equal((await reconcileWorkspaceSeats(workspaceId, { apply: true })).applied, false);
});
