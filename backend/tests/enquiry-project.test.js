const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnquiryProject, withProjectTransaction } = require('../services/enquiryProject');
const clone = value => structuredClone(value);
const same = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (value instanceof RegExp) return value.test(row[key] || '');
    if (value && typeof value === 'object') {
      if ('$ne' in value) return !same(row[key], value.$ne);
    }
    return value === null ? row[key] == null : same(row[key], value);
  });
}
function memory(rows = []) {
  const records = new Map(rows.map(row => [String(row._id), clone(row)]));
  const all = filter => [...records.values()].filter(row => matches(row, filter));
  const update = (row, patch) => { Object.assign(row, clone(patch.$set || {})); return clone(row); };
  return {
    records,
    async findById(id) { return clone(records.get(String(id)) || null); },
    async findOne(filter) { return clone(all(filter)[0] || null); },
    async find(filter = {}) { return all(filter).map(clone); },
    async findOneAndUpdate(filter, patch, options = {}) {
      let row = all(filter)[0];
      if (!row && options.upsert) {
        row = { _id: filter._id, ...clone(patch.$setOnInsert || {}) };
        assert.ok(row._id, 'test upserts must have stable IDs');
        records.set(String(row._id), row);
      }
      return row ? update(row, patch) : null;
    },
    async updateOne(filter, patch) { const row = all(filter)[0]; if (row) update(row, patch); return { matchedCount: row ? 1 : 0 }; },
    async updateMany(filter, patch) { const rows = all(filter); rows.forEach(row => update(row, patch)); return { matchedCount: rows.length }; },
  };
}
const sample = { _id: 'lead1', name: 'Maya Rao', email: 'MAYA@example.test', status: 'Follow-up', phone: '9000000000',
  eventType: 'Wedding', eventDate: new Date('2028-01-20'), eventTime: '10 AM', eventLocation: 'Bengaluru',
  notes: 'Private notes', tasks: ['task1'], people: ['Sara'], depositAmount: 2500, paymentStatus: 'Deposit Paid', totalAmount: 100000 };
function setup({ leads = [sample], contacts = [], projects = [], quotes = [] } = {}) {
  const models = { Lead: memory(leads), Contact: memory(contacts), Project: memory(projects), Quotation: memory(quotes), Event: memory([]) };
  // A serialized, rollback-capable transaction fixture. Production uses MongoDB
  // snapshot transactions and retries transient write conflicts through the driver.
  let queue = Promise.resolve();
  const transaction = work => {
    const result = queue.then(async () => {
      const snapshot = Object.fromEntries(Object.entries(models).map(([key, model]) => [key, clone([...model.records])]));
      try { return await work(null); }
      catch (error) { for (const [key, rows] of Object.entries(snapshot)) { models[key].records.clear(); for (const [id, row] of rows) models[key].records.set(id, row); } throw error; }
    });
    queue = result.catch(() => {});
    return result;
  };
  return { ...models, transaction, prepare: createEnquiryProject({ ...models, transaction }) };
}
test('manual enquiry creates one linked project and keeps existing operational data', async () => {
  const s = setup();
  const result = await s.prepare('lead1');
  assert.equal(result.lead._id, 'lead1'); assert.equal(s.Lead.records.size, 1);
  assert.equal(result.project.leadId, 'lead1');
  assert.match(result.project._id, /^[a-f\d]{24}$/); assert.match(result.project.contactId, /^[a-f\d]{24}$/);
  assert.notEqual(result.project._id, result.project.contactId, 'client and project choices keep distinct identities');
  assert.equal(result.lead.studioProjectId, result.project._id); assert.equal(result.project.status, 'Inquiry');
  assert.equal(result.project.location, 'Bengaluru'); assert.deepEqual(result.project.startDate, sample.eventDate);
  for (const key of ['notes', 'tasks', 'people', 'eventTime', 'paymentStatus', 'depositAmount', 'totalAmount', 'status'])
    assert.deepEqual(result.lead[key], sample[key], key);
  assert.equal((await s.Contact.findById(result.project.contactId)).email, 'maya@example.test');
});
test('parallel taps and retries reuse the same contact, project and enquiry', async () => {
  const s = setup();
  const results = await Promise.all(Array.from({ length: 8 }, () => s.prepare('lead1')));
  assert.equal(s.Project.records.size, 1); assert.equal(s.Contact.records.size, 1); assert.equal(s.Lead.records.size, 1);
  assert.equal(new Set(results.map(value => value.project._id)).size, 1);
  assert.equal((await s.prepare('lead1')).project._id, results[0].project._id);
});
test('reuse requires exact normalized client name and email and never changes other contact details', async () => {
  const contact = { _id: 'existing', firstName: 'MAYA', lastName: ' Rao ', email: 'maya@example.test', phone: sample.phone };
  const s = setup({ contacts: [contact, { _id: 'other-person', firstName: 'Arun', email: contact.email }] });
  const result = await s.prepare('lead1');
  assert.equal(result.project.contactId, 'existing'); assert.equal(s.Contact.records.size, 2);
  assert.deepEqual(await s.Contact.findById('existing'), contact);
  const separate = setup({ contacts: [{ _id: 'other-person', firstName: 'Arun', email: contact.email }] });
  assert.notEqual((await separate.prepare('lead1')).project.contactId, 'other-person');
  const changedPhone = setup({ contacts: [{ ...contact, phone: 'different-number' }] });
  const newLink = await changedPhone.prepare('lead1');
  assert.notEqual(newLink.project.contactId, 'existing'); assert.equal(newLink.lead.phone, sample.phone);
});
test('existing standalone quotations move to the same project without changing their snapshot or payments', async () => {
  const quote = { _id: 'quote1', lead: 'lead1', clientName: 'Maya Rao', email: 'MAYA@example.test', status: 'Accepted', totalPaise: 9000000 };
  const s = setup({ quotes: [quote] });
  const result = await s.prepare('lead1'); const linked = await s.Quotation.findById('quote1');
  assert.equal(linked.studioProjectId, result.project._id); assert.equal(linked.contactId, result.project.contactId);
  for (const key of ['clientName', 'email', 'status', 'totalPaise']) assert.deepEqual(linked[key], quote[key]);
  assert.equal(result.lead.quotationId, 'quote1'); assert.equal(result.lead.status, 'Converted');
  assert.equal(result.lead.depositAmount, sample.depositAmount); assert.equal(result.lead.paymentStatus, sample.paymentStatus);
});
test('archived, unavailable, ambiguous and conflicting records are rejected without creating a project', async () => {
  const unavailable = setup({ leads: [] }); await assert.rejects(() => unavailable.prepare('absent'), { status: 404 });
  const archived = setup({ leads: [{ ...sample, status: 'Archived' }] }); await assert.rejects(() => archived.prepare('lead1'), { status: 409 });
  const broken = setup({ leads: [{ ...sample, studioProjectId: 'missing' }] }); await assert.rejects(() => broken.prepare('lead1'), { status: 409 });
  const conflicting = setup({ quotes: [{ _id: 'q1', lead: 'lead1', studioProjectId: 'different-project' }] });
  await assert.rejects(() => conflicting.prepare('lead1'), { status: 409 });
  const ambiguous = setup({ contacts: ['c1', 'c2'].map(_id => ({ _id, firstName: 'Maya', lastName: 'Rao', email: 'maya@example.test', phone: sample.phone })) });
  await assert.rejects(() => ambiguous.prepare('lead1'), { status: 409 });
  for (const value of [unavailable, archived, broken, conflicting, ambiguous]) assert.equal(value.Project.records.size, 0);
});
test('saved project link is reused after interrupted linking', async () => {
  const s = setup({ contacts: [{ _id: 'c1', firstName: 'Maya', lastName: 'Rao', email: 'maya@example.test', phone: sample.phone }],
    projects: [{ _id: 'p1', leadId: 'lead1', contactId: 'c1', name: 'Wedding', status: 'Inquiry' }] });
  assert.equal((await s.prepare('lead1')).project._id, 'p1'); assert.equal(s.Project.records.size, 1); assert.equal(s.Lead.records.size, 1);
});
test('an explicit contact on an unmaterialised enquiry cannot replace a different name or phone', async () => {
  for (const mismatch of [{ firstName: 'Arun' }, { phone: '8000000000' }]) {
    const contact = { _id: 'c1', firstName: 'Maya', lastName: 'Rao', phone: sample.phone, email: 'maya@example.test', ...mismatch };
    const s = setup({ leads: [{ ...sample, contactId: 'c1' }], contacts: [contact] });
    await assert.rejects(() => s.prepare('lead1'), { status: 409 });
    assert.equal(s.Project.records.size, 0); assert.deepEqual(await s.Lead.findById('lead1'), { ...sample, contactId: 'c1' });
    assert.deepEqual(await s.Contact.findById('c1'), contact);
  }
});
test('failed project write rolls back the new contact so retry uses corrected enquiry details', async () => {
  const s = setup(); const original = s.Project.findOneAndUpdate;
  s.Project.findOneAndUpdate = async () => { throw new Error('Interrupted project write'); };
  await assert.rejects(() => s.prepare('lead1'), /Interrupted/);
  assert.equal(s.Contact.records.size, 0); assert.equal(s.Project.records.size, 0);
  await s.Lead.updateOne({ _id: 'lead1' }, { $set: { phone: '8000000000' } });
  s.Project.findOneAndUpdate = original;
  const result = await s.prepare('lead1');
  assert.equal((await s.Lead.findById('lead1')).phone, '8000000000'); assert.equal(s.Project.records.size, 1);
  assert.equal((await s.Contact.findById(result.project.contactId)).phone, '8000000000');
});
test('failure after project and source links roll back every new relationship', async () => {
  const s = setup(); const original = s.Quotation.updateMany;
  s.Quotation.updateMany = async () => { throw new Error('Interrupted final link write'); };
  await assert.rejects(() => s.prepare('lead1'), /Interrupted final/);
  assert.equal(s.Project.records.size, 0); assert.equal(s.Contact.records.size, 0);
  assert.deepEqual(await s.Lead.findById('lead1'), sample);
  s.Quotation.updateMany = original;
  assert.equal((await s.prepare('lead1')).lead._id, 'lead1'); assert.equal(s.Lead.records.size, 1);
});
test('a transactional write-conflict retry re-reads concurrent source edits instead of overwriting them', async () => {
  const s = setup(); const original = s.Lead.findOneAndUpdate; let first = true, attempts = 0;
  s.Lead.findOneAndUpdate = async (...args) => {
    if (first) { first = false; throw Object.assign(new Error('Simulated Mongo write conflict'), { transient: true }); }
    return original(...args);
  };
  const transaction = async work => {
    attempts++;
    try { return await s.transaction(work); }
    catch (error) {
      if (!error.transient) throw error;
      await s.Lead.updateOne({ _id: 'lead1' }, { $set: { name: 'Maya Shah', phone: '8000000000', eventDate: new Date('2028-02-14'), eventLocation: 'Mysuru', notes: 'Corrected source' } });
      attempts++; return s.transaction(work);
    }
  };
  const prepare = createEnquiryProject({ ...s, transaction }); const result = await prepare('lead1');
  assert.equal(attempts, 2); assert.equal(result.lead.name, 'Maya Shah'); assert.equal(result.lead.phone, '8000000000');
  assert.equal(result.lead.notes, 'Corrected source'); assert.equal(result.project.location, 'Mysuru');
  assert.equal(result.project.startDate.toISOString().slice(0, 10), '2028-02-14');
  const contact = await s.Contact.findById(result.project.contactId);
  assert.equal(contact.lastName, 'Shah'); assert.equal(contact.phone, '8000000000');
  assert.equal(s.Project.records.size, 1); assert.equal(s.Contact.records.size, 1);
});
test('opening an already-linked project leaves newer source edits and existing history untouched', async () => {
  const lead = { ...sample, studioProjectId: 'p1', contactId: 'c1', name: 'Corrected name', phone: '8000000000' };
  const project = { _id: 'p1', leadId: 'lead1', contactId: 'c1', name: 'Original project', status: 'Booked', notes: [{ body: 'Historic note' }] };
  const s = setup({ leads: [lead], projects: [project] });
  const result = await s.prepare('lead1'); assert.deepEqual(result.lead, lead); assert.deepEqual(result.project, project);
  assert.deepEqual(await s.Lead.findById('lead1'), lead); assert.deepEqual(await s.Project.findById('p1'), project);
});
test('unsupported transactions fail clearly, close the session and never retry writes without a transaction', async () => {
  let ended = false, writes = 0;
  const Project = { startSession: async () => ({ withTransaction: async () => { throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member'), { code: 20 }); }, endSession: async () => { ended = true; } }) };
  await assert.rejects(() => withProjectTransaction(Project, async () => { writes++; }), { status: 503 });
  assert.equal(ended, true); assert.equal(writes, 0);
});
test('historical incomplete project with edited event details requires review and keeps both sources intact', async () => {
  const project = { _id: 'p1', leadId: 'lead1', contactId: 'c1', name: 'Wedding', status: 'Inquiry', description: 'Existing planning history', startDate: new Date('2028-03-01') };
  const s = setup({ projects: [project] });
  await assert.rejects(() => s.prepare('lead1'), { status: 409 });
  assert.deepEqual(await s.Project.findById('p1'), project); assert.deepEqual(await s.Lead.findById('lead1'), sample);
  assert.equal(s.Contact.records.size, 0);
});
test('a duplicate-key race reads the committed winner without retrying non-transactional writes', async () => {
  const s = setup(); let writes = 0;
  const prepare = createEnquiryProject({ ...s, transaction: async work => { writes++; await s.transaction(work); throw Object.assign(new Error('Concurrent duplicate'), { code: 11000 }); } });
  assert.equal((await prepare('lead1')).lead.studioProjectId, [...s.Project.records.keys()][0]);
  assert.equal(writes, 1); assert.equal(s.Project.records.size, 1); assert.equal(s.Lead.records.size, 1);
});
test('existing project with conflicting explicit contact is rejected before pipeline changes', async () => {
  const lead = { ...sample, studioProjectId: 'p1', contactId: 'other-contact' };
  const s = setup({ leads: [lead], projects: [{ _id: 'p1', leadId: 'lead1', contactId: 'c1', name: 'Wedding', status: 'Inquiry' }] });
  await assert.rejects(() => s.prepare('lead1'), { status: 409 });
  assert.deepEqual(await s.Lead.findById('lead1'), lead);
});
test('project action checks saved admin authority and validates the enquiry ID before storage', async t => {
  require('./sessionFixture')(t);
  const jwt = require('jsonwebtoken'), User = require('../models/User'), service = require('../services/enquiryProject');
  const router = require('../routes/leadroutes');
  const adminId = '507f1f77bcf86cd79943fd01', clientId = '507f1f77bcf86cd79943fd02', leadId = '507f1f77bcf86cd79943fd03';
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-only-enquiry-project-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: id === adminId ? 'admin' : 'client' }) }));
  let calls = 0;
  t.mock.method(service, 'projectForEnquiry', async id => { calls++; return { project: { _id: id }, lead: { _id: id } }; });
  const dispatch = (id, role) => {
    const token = role ? jwt.sign({ user: { id: role === 'admin' ? adminId : clientId, role } }, process.env.JWT_SECRET) : '';
    return new Promise((resolve, reject) => router.handle({ method: 'POST', url: '/' + id + '/project', body: {},
      headers: token ? { authorization: 'Bearer ' + token } : {}, header: name => name.toLowerCase() === 'authorization' && token ? 'Bearer ' + token : undefined },
    { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { resolve({ status: this.statusCode, body }); } }, error => error ? reject(error) : resolve({ status: 404 })));
  };
  assert.equal((await dispatch(leadId, null)).status, 401);
  assert.equal((await dispatch(leadId, 'client')).status, 403);
  assert.equal((await dispatch('invalid', 'admin')).status, 400); assert.equal(calls, 0);
  assert.equal((await dispatch(leadId, 'admin')).status, 200); assert.equal(calls, 1);
});
