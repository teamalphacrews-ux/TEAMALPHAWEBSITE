const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');

test('parallel workspace provisioning reserves only the remaining ownership slot', {
  skip: !process.env.STUDIO_AUDIT_MONGO_PORT && 'Requires a disposable local Mongo replica set',
}, async t => {
  const port = Number(process.env.STUDIO_AUDIT_MONGO_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const mongoose = require('mongoose');
  const express = require('express');
  Object.assign(process.env, { SAAS_ENABLED: 'true', SAAS_SIGNUP_ENABLED: 'true',
    FRONTEND_URL: 'http://localhost', JWT_SECRET: crypto.randomBytes(32).toString('hex') });
  require('../saas/tenantModels').installTenantModels(mongoose);
  const { Account, Workspace, Membership } = require('../saas/models');
  const { createWorkspaceMiddleware } = require('../saas/access');
  const app = express();
  app.use(express.json(), createWorkspaceMiddleware());
  app.use('/api/saas', require('../saas/routes'));
  const database = 'audit_workspace_limit_' + crypto.randomBytes(8).toString('hex');
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/' + database, {
    directConnection: true, serverSelectionTimeoutMS: 3000,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    for (const studio of await Workspace.find({}, 'databaseName').lean()) {
      await mongoose.connection.useDb(studio.databaseName, { useCache: true }).dropDatabase();
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  async function request(path, method, body, token) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/saas/' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }
  const signUp = { firstName: 'Test', lastName: 'Owner', email: 'capacity@example.test',
    password: 'fixture-password-owner', studioName: 'Original studio' };
  const signedUp = await request('signup', 'POST', signUp);
  assert.equal(signedUp.status, 201, signedUp.data.msg);
  const { token } = signedUp.data;
  for (const step of [1, 2]) assert.equal((await request('setup', 'PATCH', { step, details: {} }, token)).status, 200);
  assert.equal((await request('setup/complete', 'POST', { details: {} }, token)).status, 200);
  const owner = await Account.findOne({ email: signUp.email });
  const create = name => request('workspaces', 'POST', { studioName: name }, token);
  for (const name of ['Second studio', 'Third studio', 'Fourth studio']) {
    assert.equal((await create(name)).status, 201);
  }
  const failedMembership = t.mock.method(Membership, 'create', async () => { throw new Error('Synthetic storage failure'); });
  const failed = await create('Interrupted studio');
  failedMembership.mock.restore();
  assert.equal(failed.status, 503);
  assert.equal(await Workspace.countDocuments({ ownerAccountId: owner._id, state: 'failed' }), 1);
  assert.equal(await Membership.countDocuments({ accountId: owner._id, role: 'owner', state: 'active' }), 4);
  const staleId = new mongoose.Types.ObjectId();
  await Workspace.create({ _id: staleId, name: 'Stale reservation', slug: 'stale-reservation',
    databaseName: 'studio_' + staleId, ownerAccountId: owner._id, trialEndsAt: new Date(), provisioningExpiresAt: new Date(0) });
  const attempts = await Promise.all([create('Studio A'), create('Studio B'), create('Studio C')]);
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409, 409]);
  assert.equal(await Workspace.countDocuments({ ownerAccountId: owner._id, state: 'active' }), 5);
  assert.equal(await Workspace.countDocuments({ ownerAccountId: owner._id, provisioningExpiresAt: { $gt: new Date() } }), 0);
  assert.equal(await Workspace.countDocuments({ ownerAccountId: owner._id }), 7);
  assert.equal(await Membership.countDocuments({ accountId: owner._id, role: 'owner', state: 'active' }), 5);
  assert.equal((await request('signup', 'POST', { ...signUp, studioName: 'Studio D' })).status, 409);
});
