const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const Contact = require('../models/StudioContact');
const Project = require('../models/StudioProject');
const Config = require('../models/StudioConfig');
const Notification = require('../models/Notification');
const projectRoutes = require('../routes/contactRoutes');
const leadRoutes = require('../routes/leadroutes');
const publicQuotes = require('../routes/publicQuoteRoutes');
const Quote = require('../models/Quotation');
const { tokenHash } = require('../utils/quoteLifecycle');

async function request(router, method, path, id, body) {
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
  await route.route.stack.at(-1).handle({ params: typeof id === 'object' && id !== null ? id : { id }, body }, response);
  return response;
}

const port = process.env.STUDIO_TEST_REPLICA_PORT;
const dbTest = { skip: !port && 'Set STUDIO_TEST_REPLICA_PORT to a disposable local MongoDB replica set.' };
async function openFixture(t) {
  assert.match(port, /^\d{1,5}$/);
  const name = 'audit_booking_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/' + name, { serverSelectionTimeoutMS: 3000 });
  t.after(async () => {
    try { if (mongoose.connection.name === name) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  t.mock.method(Notification, 'create', async () => ({})); // No external notifications.
}

test('booking, enquiry conversion and template stages roll back together and retry once', dbTest, async t => {
  await openFixture(t);
  const contact = await Contact.create({ firstName: 'Sample', email: 'sample@example.test' });
  await Config.create({ productionDefaults: { defaultTemplateId: 'sample', templates: [{
    id: 'sample', name: 'Sample', stages: [
      { title: 'Edit', category: 'Photos', dueDays: 1 },
      { title: 'Deliver', category: 'Album', dueDays: 2 },
    ],
  }] } });

  const original = Task.findOneAndUpdate;
  let rejectSecond = true;
  t.mock.method(Task, 'findOneAndUpdate', function (filter, ...args) {
    if (rejectSecond && filter.templateKey === 'sample:1') throw new Error('Synthetic write failure');
    return original.call(this, filter, ...args);
  });
  const body = { name: 'Sample shoot', contactId: contact.id, status: 'Booked' };
  const create = () => request(projectRoutes, 'post', '/studio-projects', null, body);
  assert.equal((await create()).statusCode, 500);
  assert.deepEqual(await Promise.all([Project.countDocuments(), Lead.countDocuments(), Task.countDocuments()]), [0, 0, 0]);
  body.status = 'Inquiry';
  const created = await create();
  assert.equal(created.statusCode, 201);
  const project = created.body;
  const book = () => request(projectRoutes, 'patch', '/studio-projects/:id', project.id, { status: 'Booked' });
  assert.equal((await book()).statusCode, 500);
  assert.equal((await Project.findById(project.id)).status, 'Inquiry');
  assert.equal((await Lead.findById(project.leadId)).status, 'New');
  assert.equal(await Task.countDocuments(), 0);
  rejectSecond = false;
  assert.equal((await book()).statusCode, 200);
  assert.equal((await book()).statusCode, 200);
  let lead = await Lead.findById(project.leadId);
  assert.equal(lead.status, 'Converted');
  assert.equal(lead.tasks.length, 2);
  assert.equal(await Task.countDocuments({ lead: lead.id }), 2);

  lead = await Lead.create({ name: 'Second fixture', email: 'second@example.test' });
  const convert = () => request(leadRoutes, 'patch', '/:id', lead.id, { status: 'Converted' });
  rejectSecond = true;
  assert.equal((await convert()).statusCode, 503);
  assert.equal((await Lead.findById(lead.id)).status, 'New');
  assert.equal(await Task.countDocuments({ lead: lead.id }), 0);
  rejectSecond = false;
  assert.equal((await convert()).statusCode, 200);
  assert.equal((await convert()).statusCode, 200);
  assert.equal(await Task.countDocuments({ lead: lead.id }), 2);
  assert.equal((await Lead.findById(lead.id)).tasks.length, 2);
});

test('quote acceptance resumes its original template once and never replays historical setup', dbTest, async t => {
  await openFixture(t);
  const lead = await Lead.create({ name: 'Sample client', email: 'acceptance@example.test' });
  const template = {
    id: 'initial', name: 'Original booking plan',
    stages: [{ title: 'Private prep', category: 'Other', dueDays: 0 }, { title: 'Deliver album', category: 'Album', dueDays: 10 }],
  };
  const config = await Config.create({ productionDefaults: { defaultTemplateId: template.id, templates: [template] } });
  const start = async (token, status, leadId) => Quote.create({
    shareTokenHash: tokenHash(token), clientName: 'Sample client', email: 'acceptance@example.test',
    lead: leadId, status, totalPaise: 19000, title: 'Fixture quote', expiryEnabled: false, autoCreateInvoice: false,
  });
  const accept = token => request(publicQuotes, 'post', '/:token/accept', { token }, { consent: true, acceptedBy: 'Sample client', revision: 1 });
  const token = 'd'.repeat(64);
  const quote = await start(token, 'Sent', lead.id);
  const original = Task.findOneAndUpdate;
  let interrupt = true;
  t.mock.method(Task, 'findOneAndUpdate', function (filter, ...args) {
    if (interrupt && filter.templateKey === 'initial:1') throw new Error('Synthetic interruption');
    return original.call(this, filter, ...args);
  });
  assert.equal((await accept(token)).statusCode, 503);
  const pending = await Quote.findById(quote.id);
  assert.equal(pending.status, 'Accepted');
  assert.equal(pending.pendingProductionTemplate.id, 'initial');
  assert.equal(await Task.countDocuments({ lead: lead.id }), 0);

  interrupt = false;
  const replacement = { id: 'new', name: 'Replacement', stages: [{ title: 'Unrelated stage', category: 'Other', dueDays: 2 }] };
  await Config.updateOne({ _id: config.id }, { $set: { productionDefaults: { defaultTemplateId: replacement.id, templates: [replacement] } } });
  const retries = await Promise.all([accept(token), accept(token)]);
  for (const response of retries) {
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pendingProductionTemplate, undefined);
  }
  const tasks = await Task.find({ lead: lead.id }).sort('templateKey');
  assert.deepEqual(tasks.map(task => task.title), template.stages.map(stage => stage.title));
  assert.equal((await Quote.findById(quote.id)).pendingProductionTemplate, undefined);
  await Task.db.transaction(async session => {
    await Task.deleteOne({ _id: tasks[0]._id }, { session });
    await Lead.updateOne({ _id: lead.id }, { $pull: { tasks: tasks[0]._id } }, { session });
  });
  assert.equal((await accept(token)).statusCode, 200);
  assert.equal(await Task.countDocuments({ lead: lead.id }), 1);
  assert.equal(String((await Task.findOne({ lead: lead.id }))._id), tasks[1].id);

  const historicalLead = await Lead.create({ name: 'Earlier client', email: 'earlier@example.test' });
  const historicalToken = 'e'.repeat(64);
  await start(historicalToken, 'Accepted', historicalLead.id);
  assert.equal((await accept(historicalToken)).statusCode, 200);
  assert.equal(await Task.countDocuments({ lead: historicalLead.id }), 0);
});
