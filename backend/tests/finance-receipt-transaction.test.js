const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');

test('receipt upload rollback retains the previous image and expense metadata, and re-upload is safe', {
  skip: !process.env.STUDIO_AUDIT_MONGO_PORT && 'Requires a disposable local Mongo replica set',
}, async t => {
  const port = Number(process.env.STUDIO_AUDIT_MONGO_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const database = 'audit_receipts_' + randomBytes(8).toString('hex');
  const mongoose = require('mongoose');
  const app = require('express')();
  app.use('/api/studio', require('../routes/receiptRoutes'));
  const Finance = require('../models/Finance');
  const Receipt = require('../models/FinanceReceipt');
  const User = require('../models/User');
  const security = require('../services/studioSecurity');
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/' + database, {
    directConnection: true, serverSelectionTimeoutMS: 3000,
  });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([Finance.init(), Receipt.init(), User.init()]);
  const user = await User.create({ firstName: 'Test', email: 'receipts@example.test',
    role: 'admin', studioOwner: true, password: randomBytes(32).toString('hex') });
  const token = await security.openSession(user, {}, require('jsonwebtoken').sign, process.env.JWT_SECRET);
  const expense = await Finance.create({ type: 'expense', amount: 125, description: 'Synthetic test expense' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/studio/ledger/' + expense._id + '/receipt';
  const headers = { Authorization: 'Bearer ' + token };
  const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 255, 217]);
  const updated = Buffer.from([255, 216, 255, 224, 0, 16, 1, 255, 217]);
  const upload = bytes => {
    const form = new FormData();
    form.set('receipt', new Blob([bytes], { type: 'image/jpeg' }), 'fixture.jpg');
    return fetch(endpoint, { method: 'POST', headers, body: form });
  };
  const metadata = async () => (await Finance.findById(expense._id).lean()).receipt;
  const download = async () => {
    const response = await fetch(endpoint, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return Buffer.from(await response.arrayBuffer());
  };
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await upload(jpeg)).status, 201);
  const before = await metadata();
  assert.deepEqual(await download(), jpeg);
  const failure = t.mock.method(Receipt, 'findOneAndUpdate', async () => { throw new Error('Synthetic storage failure'); });
  assert.equal((await upload(updated)).status, 503);
  failure.mock.restore();
  assert.deepEqual(await metadata(), before);
  assert.deepEqual(await download(), jpeg);
  for (let attempt = 0; attempt < 2; attempt++) assert.equal((await upload(updated)).status, 201);
  assert.equal((await metadata()).bytes, updated.length);
  assert.equal(await Receipt.countDocuments({ financeId: expense._id }), 1);
  assert.deepEqual(await download(), updated);
  assert.equal((await Finance.findById(expense._id)).amount, 125);
});
