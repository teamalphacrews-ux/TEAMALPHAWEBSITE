const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');

test('manual create retries reuse committed records, reject conflicts and preserve linked records', {
  skip: !process.env.STUDIO_AUDIT_MONGO_PORT && 'Requires a disposable loopback replica set',
}, async t => {
  const port = Number(process.env.STUDIO_AUDIT_MONGO_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const mongoose = require('mongoose'), express = require('express'), app = express();
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.BACKUP_SECRET = crypto.randomBytes(32).toString('hex');
  require('../saas/tenantModels').installTenantModels(mongoose);
  const User = require('../models/User'), Contact = require('../models/StudioContact'), Project = require('../models/StudioProject');
  const Lead = require('../models/Lead'), Task = require('../models/Task'), Notification = require('../models/Notification');
  const Receipt = require('../models/ManualCreationReceipt');
  app.use(express.json());
  app.use('/api', require('../services/studioArchiveGate').middleware());
  app.use('/api/tasks', require('../routes/taskRoutes'));
  app.use('/api/leads', require('../routes/leadroutes'));
  app.use('/api', require('../routes/contactRoutes'));
  const key = () => crypto.randomBytes(16).toString('hex');
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/audit_manual_create_' + key(), { directConnection: true, serverSelectionTimeoutMS: 3500 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const user = await User.create({ firstName: 'Fixture', email: 'owner@example.test', password: 'fixture', role: 'admin', studioOwner: true });
  const token = await require('../services/studioSecurity').openSession(user, { headers: {} }, require('jsonwebtoken').sign, process.env.JWT_SECRET);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, body, method = 'POST') => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/' + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const contact = { firstName: 'Test', email: 'test@example.test', creationKey: key() };
  const [a, b] = await Promise.all([request('contacts', contact), request('contacts', contact)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  assert.equal(a.body._id, b.body._id);
  assert.equal(await Contact.countDocuments(), 1);
  const contactId = a.body._id;
  assert.equal((await request('contacts', { ...contact, firstName: 'Changed' })).status, 409);
  assert.equal((await request('contacts', { ...contact, creationKey: key() })).status, 201);
  const sameContactReordered = { creationKey: contact.creationKey, email: contact.email, firstName: contact.firstName };
  assert.equal((await request('contacts', sameContactReordered)).body._id, contactId);

  const project = { name: 'Matching name', contactId, creationKey: key() };
  const first = await request('studio-projects', project);
  assert.equal(first.status, 201);
  assert.equal((await request('studio-projects', project)).body._id, first.body._id);
  assert.equal(await Project.countDocuments(), 1);
  assert.equal(await Lead.countDocuments({ studioProjectId: first.body._id }), 1);
  assert.equal((await request('tasks', { title: 'Unrelated task', creationKey: project.creationKey })).status, 409);

  const lead = { name: 'Test lead', email: 'lead@example.test', createAccount: true,
    firstName: 'Test', lastName: 'Client', password: 'fixture-password', creationKey: key() };
  const leadResponses = await Promise.all([request('leads', lead), request('leads', lead)]);
  assert.deepEqual(leadResponses.map(r => r.status), [200, 200]);
  const leadId = leadResponses[0].body._id;
  assert.equal(leadResponses[1].body._id, leadId);
  assert.equal(await User.countDocuments({ leadId }), 1);
  assert.equal(await Notification.countDocuments({ type: 'Lead' }), 1);
  assert.equal((await request('leads', { ...lead, password: 'changed-password' })).status, 409);
  assert.ok(!(JSON.stringify(await Receipt.find().lean())).includes('fixture-password'));

  const task = { title: 'Edit the film', creationKey: key() };
  const scoped = 'leads/' + leadId + '/tasks';
  const added = await request(scoped, task);
  assert.equal(added.status, 200);
  assert.equal((await request(scoped, task)).body._id, added.body._id);
  assert.deepEqual((await Lead.findById(leadId)).tasks.map(String), [added.body._id]);
  assert.equal((await request('tasks', { ...task, lead: leadId })).status, 409);
  const parallel = await Promise.all([
    request('tasks', { title: 'First', creationKey: 'e'.repeat(32) }),
    request('tasks', { title: 'Second', creationKey: 'e'.repeat(32) }),
  ]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [201, 409]);
  const standalone = { title: 'Edit the film', creationKey: key() };
  assert.equal((await request('tasks', { ...standalone, title: '' })).status, 400);
  const fresh = await request('tasks', standalone);
  assert.equal(fresh.status, 201);
  assert.equal((await request('tasks/' + fresh.body._id, undefined, 'DELETE')).status, 200);
  assert.equal((await request('tasks', standalone)).status, 410);
  assert.equal(await Task.countDocuments(), 2);
  const recovery = await require('../models/RecoveryRecord').findOne({ model: 'Task', recordId: fresh.body._id });
  await require('../services/studioRecovery').restoreRecovery({ id: recovery._id, actorId: user._id });
  assert.equal((await request('tasks', standalone)).body._id, fresh.body._id);
  assert.equal(await Task.countDocuments(), 3);

  const codec = require('../utils/workspaceArchive');
  assert.equal(codec.MODEL_NAMES.includes('ManualCreationReceipt'), false);
  assert.equal(require('../services/studioRecovery').MODEL_NAMES.includes('ManualCreationReceipt'), false);
  const state = require('../models/StudioArchiveState');
  await state.updateOne({ _id: 'legacy' }, { $inc: { dataVersion: 1 } });
  assert.equal((await request('contacts', contact)).status, 410);
  assert.equal((await request('contacts', { ...contact, creationKey: key() })).status, 201);

  const { runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');
  const tenantId = String(new mongoose.Types.ObjectId());
  const databaseName = workspaceDatabase(tenantId);
  const { manualCreation } = require('../utils/manualCreation');
  try {
    await runInWorkspace({ _id: tenantId, databaseName }, async () => {
      const attempt = () => manualCreation({ user: { id: String(user._id) }, body: contact }, Contact, async session => {
        const [doc] = await Contact.create([{ firstName: contact.firstName, email: contact.email }], { session });
        return doc;
      });
      const created = await attempt();
      assert.equal(created.replayed, false);
      assert.notEqual(String(created.record._id), contactId);
      assert.equal((await attempt()).replayed, true);
      assert.equal(Receipt.db.name, databaseName);
      assert.equal(await Receipt.countDocuments(), 1);
    });
  } finally { await mongoose.connection.useDb(databaseName, { useCache: true }).dropDatabase(); }
});
