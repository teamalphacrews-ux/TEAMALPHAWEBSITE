const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Workspace } = require('../saas/models');
const StudioConfig = require('../models/StudioConfig');
const { requiresSetup, allowedDuringSetup } = require('../saas/setupAccess');
const { createWorkspaceMiddleware, readToken } = require('../saas/access');
const { saveSetup, getSetup, restartSetup, validateStep, detailsOf } = require('../saas/workspaceSetup');
const { workspaceView } = require('../saas/service');
const { requestAllowed } = require('../utils/moduleAccess');

const wid = 'a'.repeat(24), aid = 'b'.repeat(24), uid = 'c'.repeat(24);
const session = { account: { _id: aid }, membership: { role: 'owner', localUserId: uid }, workspace: {
  _id: wid, databaseName: 'studio_' + wid, ownerAccountId: aid, setupStep: 1, name: 'Example', state: 'active',
} };
const tokenEnvironment = { SAAS_ENABLED: 'true', JWT_SECRET: 'workspace-setup-test-only' };

function fixture(t) {
  const workspace = new Workspace({ ...session.workspace, slug: 'example', trialEndsAt: new Date(Date.now() + 100000) });
  const config = new StudioConfig({ studioName: 'Example', email: 'owner@example.test', legalName: 'Example', invoicePrefix: 'INV',
    communication: { senderName: 'Example', replyTo: 'owner@example.test', invoiceSubject: 'Existing invoice subject' },
    billingDefaults: { quotationPrefix: 'Q', invoicePrefix: 'INV', invoiceDueDays: 30, defaultTaxPercent: 7 } });
  const tx = {};
  for (const [Model, doc] of [[Workspace, workspace], [StudioConfig, config]]) {
    t.mock.method(Model, 'findOne', () => ({ session: async value => { assert.equal(value, tx); return doc; }, then: resolve => resolve(doc) }));
    t.mock.method(doc, 'save', async options => { assert.equal(options.session, tx); return doc; });
  }
  t.mock.method(mongoose.connection, 'transaction', fn => fn(tx));
  return { workspace, config };
}

test('only newly provisioned studios are gated; existing studio names and access survive the rollout', () => {
  const old = Workspace.hydrate({ _id: wid, name: 'Original studio' });
  assert.equal(requiresSetup(old), false);
  assert.equal(workspaceView(old, session.membership).setupRequired, false);
  assert.equal(workspaceView(session.workspace, session.membership).setupRequired, true);
  assert.equal(requiresSetup({ setupCompletedAt: new Date() }), false);
});

test('pending studios can authenticate, resume, switch, sign out and upload an owner logo; operations stay gated', async () => {
  const models = { Account: { findOne: async () => session.account }, Workspace: { findOne: async () => session.workspace }, Membership: { findOne: async () => session.membership } };
  const token = jwt.sign({ user: { id: uid }, accountId: aid, workspaceId: wid }, tokenEnvironment.JWT_SECRET);
  const middleware = createWorkspaceMiddleware({ models, env: tokenEnvironment });
  for (const [method, path] of [['GET','/api/dashboard'], ['POST','/api/tasks'], ['POST','/api/calendar/connect'], ['PUT','/api/studio/settings'], ['POST','/api/saas/invitations'], ['GET','/api/saas/workspace'], ['POST','/api/saas/workspaces']]) {
    const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.value = value; } };
    await middleware({ method, originalUrl: path, headers: { authorization: 'Bearer ' + token } }, res, () => assert.fail(path));
    assert.equal(res.statusCode, 409);
    assert.equal(res.value.code, 'STUDIO_SETUP_REQUIRED');
  }
  for (const [method,path] of [['GET','/api/auth/me'], ['GET','/api/saas/setup'], ['POST','/api/studio/security/logout'], ['POST','/api/saas/workspaces/' + wid + '/switch']]) {
    assert.equal(allowedDuringSetup(method, path, 'staff'), true);
    const req = { method, originalUrl: path, saas: session };
    assert.equal(requestAllowed({ role: 'admin', moduleAccess: [] }, req), true);
  }
  assert.equal(allowedDuringSetup('POST','/api/studio/profile-images','staff'), false);
  assert.equal(allowedDuringSetup('POST','/api/studio/profile-images','owner'), true);
  assert.equal(readToken({ headers: { authorization:'Bearer other-credential', 'x-auth-token':'same-as-router-auth' } }), 'same-as-router-auth');
});

test('members see only status and cannot write to the owner’s setup; validation rejects unadvertised fields', async t => {
  const { config } = fixture(t);
  const member = { ...session, membership: { role: 'staff' }, account: { _id: uid } };
  const status = await getSetup(member);
  assert.deepEqual(status.details, {});
  assert.equal(status.canManage, false);
  await assert.rejects(saveSetup(member, {step:1,details:{studioName:'Other'}}), {status:403});
  const details = detailsOf(config);
  assert.throws(() => validateStep(1, { studioName: '', website: 'https://user:pass@example.test' }, details), e => e.status === 400 && !!e.fieldErrors.studioName && !!e.fieldErrors.website);
  assert.throws(() => validateStep(2, { email: 'bad' }, details), e => e.status === 400 && !!e.fieldErrors.email);
  assert.throws(() => validateStep(3, { invoiceDueDays: -1, gstin: 'invalid' }, details), e => e.status === 400 && !!e.fieldErrors.invoiceDueDays && !!e.fieldErrors.gstin);
  assert.throws(() => validateStep(2, { email: 'studio@example.test', setupCompletedAt: true }, details), {status:400});
});

test('setup resumes from tenant settings, persists normalized billing defaults and unlocks exactly once', async t => {
  const { workspace, config } = fixture(t);
  assert.equal((await getSetup(session)).step, 1);
  await assert.rejects(saveSetup(session,{details:{}},true), {status:409});
  await assert.rejects(saveSetup(session,{step:2,details:{email:'skip@example.test'}}), {status:409});
  await saveSetup(session,{step:1,details:{studioName:'New Studio',legalName:'New Studio Ltd',website:'https://example.test'}});
  assert.equal(workspace.name, 'New Studio');
  assert.equal(config.communication.senderName, 'New Studio');
  const resumed = await getSetup({ ...session, workspace });
  assert.equal(resumed.step,2);
  assert.equal(resumed.details.legalName,'New Studio Ltd');
  await saveSetup(session,{step:2,details:{email:' STUDIO@EXAMPLE.TEST ',address:'Bengaluru'}});
  assert.equal(config.communication.replyTo, 'studio@example.test');
  assert.equal(config.communication.invoiceSubject, 'Existing invoice subject');
  await assert.rejects(saveSetup(session,{},true), {status:409});
  const result = await saveSetup(session,{details:{invoicePrefix:'ns-inv',quotationPrefix:'ns-q',quotationValidityDays:21,invoiceDueDays:7}},true);
  assert.equal(result.workspace.setupRequired, false);
  assert.equal(config.invoicePrefix, 'NS-INV');
  assert.equal(config.billingDefaults.invoicePrefix, 'NS-INV');
  assert.equal(config.billingDefaults.quotationPrefix, 'NS-Q');
  assert.equal(config.billingDefaults.defaultTaxPercent, 7);
  assert.equal(config.quotationValidityDays,21);
  const completedAt = workspace.setupCompletedAt.valueOf();
  assert.deepEqual((await saveSetup(session,{},true)).workspace,result.workspace);
  assert.equal(workspace.setupCompletedAt.valueOf(),completedAt);
  await assert.rejects(saveSetup(session,{step:1,details:{studioName:'Old tab'}}), {status:409});
  assert.equal(workspace.name,'New Studio');
});

test('optional social profiles use Settings validation and survive unrelated edits', async t => {
  const { config, workspace } = fixture(t);
  await saveSetup(session, { step: 1, details: {} });
  const status = await saveSetup(session, { step: 2, details: {
    instagramUrl: 'https://www.instagram.com/example', facebookUrl: 'https://fb.com/example',
  } });
  assert.equal(status.details.instagramUrl, 'https://www.instagram.com/example');
  assert.equal(status.details.facebookUrl, 'https://fb.com/example');
  await assert.rejects(saveSetup(session, { step: 2, details: {
    instagramUrl: 'https://instagram.com.example.test/studio', facebookUrl: 'http://facebook.com/example',
  } }), error => error.status === 400 && !!error.fieldErrors.instagramUrl && !!error.fieldErrors.facebookUrl);
  await saveSetup(session, { step: 2, details: { address: 'New address' } });
  assert.equal(config.instagramUrl, status.details.instagramUrl);
  assert.equal(config.facebookUrl, status.details.facebookUrl);
  await saveSetup(session, { step: 2, details: { facebookUrl: '' } });
  assert.equal((await getSetup({ ...session, workspace })).details.facebookUrl, '');
  assert.equal(config.instagramUrl, status.details.instagramUrl);
});

test('a saved third step may be finished later and earlier edits do not return its progress to step one', async t => {
  const { workspace, config } = fixture(t);
  await saveSetup(session,{step:1,details:{}});
  await saveSetup(session,{step:2,details:{}});
  const saved = await saveSetup(session,{step:3,details:{}});
  assert.equal(saved.workspace.setupRequired,true);
  assert.equal(saved.step,3);
  await saveSetup(session,{step:1,details:{studioName:'Renamed'}});
  assert.equal(workspace.setupStep,4);
  config.email = '';
  await assert.rejects(saveSetup(session,{},true), e => e.status===400 && !!e.fieldErrors.email);
  assert.equal(requiresSetup(workspace),true);
  await saveSetup(session,{step:2,details:{email:'owner@example.test'}});
  const opened = await saveSetup(session,{},true);
  assert.equal(opened.workspace.name,'Renamed');
  assert.equal(opened.workspace.setupRequired,false);
});

test('a required restart retains all saved details, resets the cursor and rejects outstanding saves', async t => {
  const { workspace, config } = fixture(t);
  await saveSetup(session, { step: 1, details: { studioName: 'Saved Studio' } });
  await saveSetup(session, { step: 2, details: { email: 'saved@example.test' } });
  const originalProfile = config.toObject();
  const fresh = await restartSetup(session, {});
  assert.deepEqual(config.toObject(), originalProfile);
  assert.equal(fresh.workspace.setupRequired, true);
  assert.equal(fresh.reviewActive, false);
  assert.equal(fresh.details.email, 'saved@example.test');
  assert.equal(fresh.step, 1);
  assert.equal(fresh.revision, 1);
  await assert.rejects(saveSetup(session, { details: {} }, true), { status: 409 });
  await assert.rejects(saveSetup(session, { step: 2, revision: 1, details: {} }), { status: 409 });
  await saveSetup(session, { step: 1, revision: 1, details: {} });
  await saveSetup(session, { step: 2, revision: 1, details: {} });
  const finished = await saveSetup(session, { revision: 1, details: {} }, true);
  assert.equal(finished.workspace.setupRequired, false);
  assert.ok(workspace.setupCompletedAt);
});

test('revisiting setup leaves team access and customized business settings intact for established studios', async t => {
  const { workspace, config } = fixture(t);
  workspace.setupStep = undefined;
  workspace.name = 'Workspace directory name';
  config.invoicePrefix = 'LEGACY';
  config.communication.senderName = 'Billing Department';
  config.communication.replyTo = 'billing@example.test';
  const original = config.toObject(), originalDate = new Date('2025-01-11');
  workspace.setupCompletedAt = originalDate;
  const owner = { ...session, workspace };
  const joined = { ...owner, account: { _id: uid }, membership: { role: 'staff', localUserId: uid } };
  await assert.rejects(restartSetup(joined, {}), { status: 403 });
  assert.throws(() => restartSetup(owner, { workspaceId: 'other' }), { status: 400 });
  const review = await restartSetup(owner, {});
  assert.equal(review.workspace.setupRequired, false);
  assert.equal(review.reviewActive, true);
  assert.equal(review.step, 1);
  const member = await getSetup(joined);
  assert.equal(member.workspace.setupRequired, false);
  assert.equal(member.reviewActive, false);
  assert.deepEqual(member.details, {});
  const key = { revision: review.revision };
  const first = await saveSetup(owner, { step: 1, ...key, details: { studioName: 'Example' } });
  assert.equal(first.step, 2);
  assert.equal(first.workspace.name, 'Workspace directory name');
  assert.equal((await getSetup(owner)).step, 2);
  await saveSetup(owner, { step: 2, ...key, details: {} });
  const last = await saveSetup(owner, { ...key, details: {} }, true);
  assert.equal(last.reviewActive, false);
  assert.equal(last.workspace.setupRequired, false);
  assert.deepEqual(config.toObject(), original);
  assert.deepEqual(workspace.setupCompletedAt, originalDate);

  // When the owner does edit, update the fields shown in setup without
  // silently replacing independent accounting or communication settings.
  const second = { revision: (await restartSetup(owner, {})).revision };
  await assert.rejects(saveSetup(owner, { ...key, step: 1, details: { studioName: 'Old form' } }), { status: 409 });
  await saveSetup(owner, { step: 1, ...second, details: { studioName: 'Updated' } });
  await saveSetup(owner, { step: 2, ...second, details: { email: 'hello@example.test' } });
  await saveSetup(owner, { ...second, details: { invoicePrefix: 'NEW' } }, true);
  assert.equal(config.studioName, 'Updated');
  assert.equal(config.email, 'hello@example.test');
  assert.equal(config.billingDefaults.invoicePrefix, 'NEW');
  assert.equal(config.invoicePrefix, 'LEGACY');
  assert.equal(config.communication.senderName, 'Billing Department');
  assert.equal(config.communication.replyTo, 'billing@example.test');
});

test('optional review respects subscription restrictions and existing invoice payment schedules', async t => {
  const { workspace, config } = fixture(t);
  workspace.setupStep = undefined;
  const owner = { ...session, workspace };
  workspace.subscriptionStatus = 'expired';
  await assert.rejects(restartSetup(owner), { status: 402 });
  workspace.subscriptionStatus = 'active';
  await restartSetup(owner);
  const key = { revision: 1 };
  await saveSetup(owner, { ...key, step: 1, details: {} });
  await saveSetup(owner, { ...key, step: 2, details: {} });
  config.billingDefaults.paymentScheduleEnabled = true;
  config.billingDefaults.paymentMilestones = [
    { label: 'Booking', percent: 50, offsetDays: 0 },
    { label: 'Delivery', percent: 50, offsetDays: 20 },
  ];
  await assert.rejects(saveSetup(owner, { ...key, details: { invoiceDueDays: 7 } }, true),
    error => error.status === 400 && !!error.fieldErrors.invoiceDueDays);
  assert.equal(config.billingDefaults.invoiceDueDays, 30);
  workspace.subscriptionStatus = 'expired';
  await assert.rejects(saveSetup(owner, { ...key, details: {} }, true), { status: 402 });
  assert.equal(workspace.setupCompletedAt, undefined);
  assert.equal(requiresSetup(workspace), false);
});
