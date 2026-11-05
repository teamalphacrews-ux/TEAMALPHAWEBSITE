const test = require('node:test');
const assert = require('node:assert/strict');
const Mongoose = require('mongoose');
const { runInWorkspace, currentWorkspace, workspaceDatabase } = require('../saas/tenantContext');
const { installTenantModels } = require('../saas/tenantModels');

const A = Object.freeze({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', databaseName: 'studio_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Studio A' });
const B = Object.freeze({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', databaseName: 'studio_bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Studio B' });

function fixture() {
  const mongoose = new Mongoose.Mongoose({ autoCreate: false, autoIndex: false, bufferCommands: false });
  mongoose.connection.name = 'legacy';
  const installation = installTenantModels(mongoose);
  const Client = mongoose.model('TenantTestClient', new mongoose.Schema({ name: String }));
  const Booking = mongoose.model('TenantTestBooking', new mongoose.Schema({ client: { type: mongoose.Schema.Types.ObjectId, ref: 'TenantTestClient' }, name: String }));
  const Workspace = mongoose.connection.model('SaaSWorkspace', new mongoose.Schema({ name: String }));
  return { mongoose, Client, Booking, Workspace, installation };
}

test('workspace context validates deterministic database identity and explicitly resets legacy work', async () => {
  assert.equal(workspaceDatabase('ABCDEFABCDEFABCDEFABCDEF'), 'studio_abcdefabcdefabcdefabcdef');
  assert.equal(currentWorkspace(), null);
  for (const input of [undefined, {}, [], { _id: A._id, databaseName: B.databaseName }, { _id: '../other', databaseName: 'studio_../other' }]) {
    assert.throws(() => runInWorkspace(input, () => assert.fail('Invalid work must not run')), { code: 'WORKSPACE_CONTEXT_INVALID' });
  }
  const mutable = { ...A };
  await runInWorkspace(mutable, async () => {
    mutable.databaseName = B.databaseName;
    assert.equal(currentWorkspace().databaseName, A.databaseName);
    assert.equal(Object.isFrozen(currentWorkspace()), true);
    await runInWorkspace(B, async () => { await Promise.resolve(); assert.equal(currentWorkspace()._id, B._id); });
    assert.equal(currentWorkspace()._id, A._id);
    runInWorkspace(null, () => assert.equal(currentWorkspace(), null));
    assert.equal(currentWorkspace()._id, A._id);
  });
  assert.equal(currentWorkspace(), null);
});

test('model cache imports and destructured statics resolve the real selected Mongoose database', async () => {
  const { mongoose, Client, installation } = fixture();
  assert.equal(installTenantModels(mongoose), installation);
  assert.equal(mongoose.model('TenantTestClient'), Client);
  assert.equal(mongoose.models.TenantTestClient, Client);
  assert.equal(Client.find().model.db.name, 'legacy');
  const find = Client.find, count = Client.countDocuments, remove = Client.deleteMany;
  await Promise.all(Array.from({ length: 20 }, async (_, index) => {
    const workspace = index % 2 ? A : B;
    await runInWorkspace(workspace, async () => {
      await Promise.resolve();
      assert.equal(find({ name: 'selected' }).model.db.name, workspace.databaseName);
      assert.equal(count({}).model.db.name, workspace.databaseName);
      assert.equal(remove({}).model.db.name, workspace.databaseName);
      assert.equal(Client.findById('cccccccccccccccccccccccc').model.db.name, workspace.databaseName);
      assert.equal(Client.updateMany({}, { $set: { name: 'x' } }).model.db.name, workspace.databaseName);
      assert.equal(Client.distinct('name').model.db.name, workspace.databaseName);
      assert.equal(Client.aggregate([{ $match: {} }]).model().db.name, workspace.databaseName);
      assert.equal(Client.collection.conn.name, workspace.databaseName);
      assert.equal(Client.db, Client.find().model.db);
    });
  }));
  assert.equal(Client.find().model.db.name, 'legacy');
});

test('returned queries and constructed documents keep their original connection across contexts', async () => {
  const { Client } = fixture();
  const [query, document, called] = runInWorkspace(A, () => [Client.find(), new Client({ name: 'A' }), Client({ name: 'called' })]);
  runInWorkspace(B, () => {
    assert.equal(query.model.db.name, A.databaseName);
    assert.equal(document.constructor.db.name, A.databaseName);
    assert.equal(called.constructor.db.name, A.databaseName);
    assert.equal(new Client({ name: 'B' }).constructor.db.name, B.databaseName);
  });
  assert.equal(document.constructor.db.name, A.databaseName);
});

test('cached raw collection methods dispatch into their invocation workspace', async t => {
  const { Client, mongoose } = fixture();
  const collection = Client.collection;
  const createIndex = collection.createIndex;
  const calls = [];
  for (const workspace of [A, B]) runInWorkspace(workspace, () => {
    const selected = Client.find().model.collection;
    t.mock.method(selected, 'createIndex', async function (keys) { calls.push({ database: this.conn.name, keys }); return 'index'; });
  });
  await Promise.all([A, B].map(workspace => runInWorkspace(workspace, () => createIndex({ name: 1 }))));
  assert.deepEqual(calls.map(call => call.database).sort(), [A.databaseName, B.databaseName].sort());
  assert.equal(collection.conn, mongoose.connection);
});

test('save, create, insertMany and bulkWrite use tenant collections without a database server', async t => {
  const { Client } = fixture();
  const calls = [];
  const documentA = runInWorkspace(A, () => new Client({ name: 'A' }));
  for (const workspace of [A, B]) runInWorkspace(workspace, () => {
    const selected = Client.find().model.collection;
    t.mock.method(selected, 'insertOne', async function (record) { calls.push(['save', this.conn.name]); return { acknowledged: true, insertedId: record._id }; });
    t.mock.method(selected, 'insertMany', async function (records) { calls.push(['insertMany', this.conn.name]); return { acknowledged: true, insertedCount: records.length }; });
    t.mock.method(selected, 'bulkWrite', async function () { calls.push(['bulkWrite', this.conn.name]); return { acknowledged: true, matchedCount: 1 }; });
  });
  await runInWorkspace(B, async () => {
    await documentA.save();
    await Client.create({ name: 'B' });
    await Client.insertMany([{ name: 'many' }]);
    await Client.bulkWrite([{ updateOne: { filter: { name: 'B' }, update: { $set: { name: 'updated' } } } }]);
  });
  assert.deepEqual(calls, [['save', A.databaseName], ['save', B.databaseName], ['insertMany', B.databaseName], ['bulkWrite', B.databaseName]]);
});

test('populate registers all schemas and resolves references on the document database', async t => {
  const { mongoose, Client, Booking, Workspace } = fixture();
  const clientId = new mongoose.Types.ObjectId();
  const booking = runInWorkspace(A, () => new Booking({ name: 'A booking', client: clientId }));
  const connection = booking.constructor.db;
  assert.ok(connection.models.TenantTestClient);
  assert.ok(connection.models.TenantTestBooking);
  assert.equal(connection.models.SaaSWorkspace, undefined);
  t.mock.method(connection.models.TenantTestClient.collection, 'find', function () {
    assert.equal(this.conn.name, A.databaseName);
    return { toArray: async () => [{ _id: clientId, name: 'A client' }] };
  });
  await runInWorkspace(B, () => booking.populate('client'));
  assert.equal(booking.client.name, 'A client');
  assert.equal(booking.client.constructor.db.name, A.databaseName);
  runInWorkspace(B, () => {
    assert.equal(Client.find().model.db.name, B.databaseName);
    assert.equal(Workspace.find().model.db.name, 'legacy');
    assert.equal(mongoose.models.SaaSWorkspace, Workspace);
    assert.equal(mongoose.model('SaaSWorkspace'), Workspace);
  });
});

test('schemas first registered during a request remain legacy-defined and route on later calls', () => {
  const { mongoose } = fixture();
  const Later = runInWorkspace(A, () => mongoose.model('TenantTestLater', new mongoose.Schema({ name: String })));
  assert.equal(Later.find().model.db.name, 'legacy');
  runInWorkspace(B, () => assert.equal(Later.find().model.db.name, B.databaseName));
  runInWorkspace(A, () => assert.equal(Later.find().model.db.name, A.databaseName));
});
