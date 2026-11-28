const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { resolveSession, createWorkspaceMiddleware, requestAllowed } = require('../saas/access');
const { currentWorkspace } = require('../saas/tenantContext');
const { plans, accessStatus } = require('../saas/plans');
const { validSignature, paymentSignature, refreshSubscription } = require('../saas/billing');
const wid = 'a'.repeat(24), accountId = 'b'.repeat(24), uid = 'c'.repeat(24);
const env = { SAAS_ENABLED: 'true', JWT_SECRET: 'isolated-saas-test-secret-only' };
const workspace = () => ({ _id: wid, databaseName: 'studio_' + wid, state: 'active', subscriptionStatus: 'trialing', trialEndsAt: new Date(Date.now() + 86400000) });
const token = extra => jwt.sign({ user: { id: uid, role: 'admin' }, workspaceId: wid, accountId, ...extra }, env.JWT_SECRET);
function registry({ role = 'staff', revoked = false, studio = workspace() } = {}) {
  return { Account: { findOne: async filter => filter._id === accountId ? { _id: accountId, state: 'active' } : null },
    Workspace: { findOne: async filter => filter._id === wid ? studio : null },
    Membership: { findOne: async filter => !revoked && filter.workspaceId === wid && filter.accountId === accountId && filter.localUserId === uid ? { role, localUserId: uid, state: 'active' } : null } };
}
function response() { return { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } }; }
test('workspace access revalidates membership and ignores client supplied studio selectors', async () => {
  const session = await resolveSession(token(), { models: registry(), env });
  assert.equal(session.membership.role, 'staff');
  await assert.rejects(resolveSession(token(), { models: registry({ revoked: true }), env }), error => error.status === 401);
  await assert.rejects(resolveSession(token({ workspaceId: 'd'.repeat(24) }), { models: registry(), env }), error => error.status === 401);
  await assert.rejects(resolveSession(token(), { models: registry(), env: { ...env, SAAS_ENABLED: 'false' } }), error => error.status === 401);
  let selected;
  await createWorkspaceMiddleware({ models: registry(), env })({ headers: { authorization: 'Bearer ' + token(), 'x-workspace-id': 'd'.repeat(24) }, originalUrl: '/api/calendar', method: 'GET' }, response(), () => { selected = currentWorkspace()._id; });
  assert.equal(selected, wid); assert.equal(currentWorkspace(), null);
});
test('role controls and expired trials protect writes while allowing renewal and reads', async () => {
  assert.equal(requestAllowed('staff', 'POST', '/api/finance'), false);
  assert.equal(requestAllowed('staff', 'GET', '/api/finance'), true);
  assert.equal(requestAllowed('staff', 'PATCH', '/api/tasks/123'), true);
  assert.equal(requestAllowed('staff', 'DELETE', '/api/calendar/123'), false);
  assert.equal(requestAllowed('staff', 'PUT', '/api/studio/settings'), false);
  const expired = { ...workspace(), trialEndsAt: new Date(0) };
  assert.equal(accessStatus(expired), 'read_only');
  const middleware = createWorkspaceMiddleware({ models: registry({ role: 'owner', studio: expired }), env });
  const res = response(); let continued = false;
  await middleware({ headers: { authorization: 'Bearer ' + token() }, method: 'POST', originalUrl: '/api/leads' }, res, () => { continued = true; });
  assert.equal(res.code, 402); assert.equal(continued, false);
  await middleware({ headers: { authorization: 'Bearer ' + token() }, method: 'POST', originalUrl: '/api/saas/billing/checkout' }, response(), () => { continued = true; });
  assert.equal(continued, true);
});
test('public smart links are independent of the viewer account and integrations fail closed', async () => {
  const middleware = createWorkspaceMiddleware({ models: registry(), env });
  let called = false;
  await middleware({ headers: { authorization: 'Bearer invalid' }, originalUrl: '/api/quotes/' + wid + '.' + 'f'.repeat(64), method: 'POST' }, response(), () => { called = true; });
  assert.equal(called, true);
  const res = response();
  await middleware({ headers: { authorization: 'Bearer ' + token() }, originalUrl: '/api/media', method: 'GET' }, res, () => assert.fail('Legacy integration credentials must not be inherited'));
  assert.equal(res.code, 409);
});
test('workspace integration access admits only tenant-scoped routes with the existing role and plan checks', async () => {
  async function request(method, path, options = { role: 'owner' }) {
    const res = response();
    const middleware = createWorkspaceMiddleware({ models: registry(options), env });
    let selected;
    await middleware({ headers: { authorization: 'Bearer ' + token() }, originalUrl: path, method }, res, () => { selected = currentWorkspace()._id; });
    return { status: res.code, selected };
  }
  for (const [method, path] of [
    ['GET', '/api/integrations/gmail/messages/abc_123?folder=inbox'],
    ['POST', '/api/integrations/gmail/connect'],
    ['GET', '/api/integrations/assistants/status'],
    ['POST', '/api/integrations/assistants/openai/draft'],
    ['DELETE', '/api/integrations/assistants/claude/connection'],
  ]) assert.deepEqual(await request(method, path), { status: 200, selected: wid });
  assert.equal((await request('GET', '/api/integrations/gmail/status', { role: 'admin' })).status, 200);
  assert.equal((await request('GET', '/api/integrations/gmail/status', { role: 'staff' })).status, 403);
  const expired = { role: 'owner', studio: { ...workspace(), trialEndsAt: new Date(0) } };
  assert.equal((await request('POST', '/api/integrations/assistants/openai/test', expired)).status, 402);
  for (const [method, path] of [
    ['GET', '/api/integrations/gmail/begin'],
    ['PUT', '/api/integrations/gmail/connect'],
    ['POST', '/api/integrations/assistants/openclaw/test'],
    ['GET', '/api/integrations/whatsapp/status'],
    ['GET', '/api/Integrations/drive-backups/status'],
  ]) assert.deepEqual(await request(method, path), { status: 409, selected: undefined });
});
test('plans never invent prices or enable checkout without a complete configuration', () => {
  assert.equal(plans({})[0].monthlyAmount, null); assert.equal(plans({})[0].configured, false);
  assert.equal(plans({ SAAS_STARTER_MONTHLY_INR: 'bad' })[0].configured, false);
  const configured = plans({ SAAS_STARTER_MONTHLY_INR: '1500', RAZORPAY_STARTER_PLAN_ID: 'plan_TEST', RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'test-only' })[0];
  assert.equal(configured.monthlyAmount, 1500); assert.equal(configured.configured, true);
});
test('Razorpay signatures require the exact payment/subscription and reject malformed values', () => {
  const secret = 'test-only-secret', signature = crypto.createHmac('sha256', secret).update('pay_example|sub_example').digest('hex');
  assert.equal(paymentSignature('pay_example', 'sub_example', secret), signature);
  assert.equal(validSignature(signature, signature), true);
  assert.equal(validSignature(signature.slice(1), signature), false);
  assert.equal(validSignature(paymentSignature('pay_other', 'sub_example', secret), signature), false);
  assert.equal(validSignature('not-a-signature', signature), false);
});
test('billing refresh serializes provider reconciliation and refuses overlapping refreshes', async () => {
  const updates = [], model = { Workspace: { findOneAndUpdate: async () => null, updateOne: async (...args) => updates.push(args) } };
  await assert.rejects(refreshSubscription({ _id: wid }, 'sub_example', { models: model }), error => error.status === 409);
  assert.equal(updates.length, 0);
});

test('monthly plan configuration agrees with the displayed positive whole-rupee price', () => {
  for (const price of ['0.50', '2.25', '9007199254740991']) {
    const plan = plans({ ...env, SAAS_STARTER_MONTHLY_INR: price, RAZORPAY_STARTER_PLAN_ID: 'plan_TEST', RAZORPAY_KEY_ID: 'test', RAZORPAY_KEY_SECRET: 'test' })[0];
    assert.equal(plan.configured, false, price);
    assert.equal(plan.monthlyAmount, null, price);
  }
});
