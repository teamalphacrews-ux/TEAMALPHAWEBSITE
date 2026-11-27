const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');

test('personal recovery preserves the owner and refuses repeated reset and restore after new expense writes', {
  skip: !process.env.STUDIO_AUDIT_MONGO_PORT && 'Requires a disposable local Mongo replica set',
}, async t => {
  const port = Number(process.env.STUDIO_AUDIT_MONGO_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const database = 'audit_replacement_' + randomBytes(8).toString('hex');
  const mongoose = require('mongoose');
  const express = require('express');
  const gate = require('../services/studioArchiveGate');
  gate.installWriteFence(mongoose);
  const codec = require('../utils/workspaceArchive');
  codec.registry();
  const router = require('../routes/studioArchiveRoutes');
  const User = require('../models/User');
  const Finance = require('../models/Finance');
  const security = require('../services/studioSecurity');
  const { RESET_CONFIRMATION, RESTORE_CONFIRMATION } = require('../services/studioArchive');
  Object.assign(process.env, { JWT_SECRET: randomBytes(32).toString('hex'),
    BACKUP_SECRET: randomBytes(32).toString('hex'), WORKSPACE_RECOVERY_ENABLED: 'true' });
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/' + database, {
    directConnection: true, serverSelectionTimeoutMS: 3000,
  });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const password = randomBytes(18).toString('hex');
  const user = await gate.withShared(async () => User.create({ firstName: 'Owner', email: 'workspace-reset@example.test',
    role: 'admin', studioOwner: true, password: await require('bcryptjs').hash(password, 8) }));
  const token = await gate.withShared(() => security.openSession(user, {}, require('jsonwebtoken').sign, process.env.JWT_SECRET));
  const expense = amount => gate.withShared(() => Finance.create({ type: 'expense', amount }));
  const original = await expense(50);
  const app = express();
  app.use(express.json(), gate.middleware());
  app.use('/api/studio/security', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/studio/security/';
  const call = async (path, data) => {
    const headers = { Authorization: 'Bearer ' + token };
    if (data && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(endpoint + path, { method: data === undefined ? 'GET' : 'POST', headers,
      body: data instanceof FormData ? data : JSON.stringify(data) });
    return { status: res.status, body: await res.json() };
  };
  const ready = await call('workspace-data');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.resetBlocked, false);
  const reset = { password, confirmation: RESET_CONFIRMATION, expectedDataVersion: ready.body.dataVersion };
  const done = await call('workspace-reset', reset);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(await Finance.countDocuments(), 0);
  const first = await expense(60);
  assert.equal((await call('workspace-reset', reset)).status, 409);
  assert.equal((await Finance.findById(first._id)).amount, 60);
  const saved = await call('workspace-backups/' + done.body.safetyBackupId + '/download');
  assert.equal(saved.status, 200);
  const archive = new Blob([JSON.stringify(saved.body)], { type: 'application/json' });
  const form = () => {
    const data = new FormData();
    data.set('archive', archive, 'fixture.teamalpha.json');
    return data;
  };
  const inspection = await call('workspace-restore/inspect', form());
  assert.equal(inspection.status, 200);
  assert.equal(inspection.body.dataVersion, done.body.dataVersion);
  const restore = () => {
    const data = form();
    data.set('confirmation', RESTORE_CONFIRMATION);
    data.set('password', password);
    data.set('expectedDataVersion', String(inspection.body.dataVersion));
    return call('workspace-restore', data);
  };
  const restored = await restore();
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.equal((await Finance.findById(original._id)).amount, 50);
  assert.equal(await Finance.exists({ _id: first._id }), null);
  const last = await expense(70);
  assert.equal((await restore()).status, 409);
  assert.equal((await Finance.findById(last._id)).amount, 70);
  assert.equal((await call('workspace-data')).body.dataVersion, 2);
});
