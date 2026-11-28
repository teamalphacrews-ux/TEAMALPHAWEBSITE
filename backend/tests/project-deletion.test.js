const { test } = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const Contact = require('../models/StudioContact');
const { detachUnusedProject, restoreProjectEnquiry } = require('../services/projectDeletion');

const row = { _id: 'project', leadId: 'enquiry', contactId: 'client', additionalClients: ['other-client'] };
const enquiry = { _id: row.leadId, contactId: row.contactId, studioProjectId: row._id };
const session = {};

function prepare(t, { existingLead = enquiry, linkedModel, matchedCount = 1 } = {}) {
  const reads = [], writes = [];
  t.mock.method(Lead, 'findOne', filter => {
    assert.deepEqual(filter, { studioProjectId: row._id });
    return { session(actual) {
      assert.equal(actual, session);
      return { lean: async () => existingLead };
    } };
  });
  for (const name of ['Quotation', 'Invoice', 'Finance', 'Event', 'ContactDocument', 'Task', 'AssetRecord']) {
    t.mock.method(require('../models/' + name), 'exists', filter => ({
      async session(actual) {
        assert.equal(actual, session);
        reads.push({ name, filter });
        return name === linkedModel ? { _id: 'attached-record' } : null;
      },
    }));
  }
  t.mock.method(Lead, 'updateOne', async (filter, update, options) => {
    writes.push({ filter, update, options });
    return { matchedCount };
  });
  return { reads, writes };
}

test('deleting an unused project unlinks its enquiry within the recovery transaction', async t => {
  const { reads, writes } = prepare(t);
  await detachUnusedProject({ row, session });
  assert.equal(reads.length, 7);
  assert.deepEqual(reads[0].filter, { $or: [{ studioProjectId: row._id }, { lead: row.leadId }] });
  assert.deepEqual(writes, [{
    filter: { _id: row.leadId, studioProjectId: row._id, contactId: row.contactId },
    update: { $unset: { studioProjectId: '' } },
    options: { session },
  }]);
});

test('a linked document, booking or production record blocks project deletion and leaves its enquiry intact', async t => {
  for (const name of ['Quotation', 'Invoice', 'Finance', 'Event', 'ContactDocument', 'Task', 'AssetRecord']) {
    await t.test(name, async t => {
      const { writes } = prepare(t, { linkedModel: name });
      await assert.rejects(detachUnusedProject({ row, session }), error => error.status === 409 && /Archive it/.test(error.message));
      assert.deepEqual(writes, []);
    });
  }
});

test('project deletion refuses an inconsistent or concurrently changed enquiry link', async t => {
  await t.test('inconsistent contact', async t => {
    const { writes } = prepare(t, { existingLead: { ...enquiry, contactId: 'different-contact' } });
    await assert.rejects(detachUnusedProject({ row, session }), error => error.status === 409 && /enquiry connection/.test(error.message));
    assert.deepEqual(writes, []);
  });
  await t.test('unlinked concurrently', async t => {
    prepare(t, { matchedCount: 0 });
    await assert.rejects(detachUnusedProject({ row, session }), error => error.status === 409 && /changed/.test(error.message));
  });
});

test('restoring a project rejoins its enquiry while preserving links to other projects', async t => {
  const { writes } = prepare(t);
  t.mock.method(Contact, 'countDocuments', filter => ({
    async session(actual) {
      assert.deepEqual(filter, { _id: { $in: ['client', 'other-client'] } });
      assert.equal(actual, session);
      return 2;
    },
  }));
  await restoreProjectEnquiry(row, session);
  assert.deepEqual(writes, [{
    filter: { _id: row.leadId, contactId: row.contactId, $or: [{ studioProjectId: null }, { studioProjectId: row._id }] },
    update: { $set: { studioProjectId: row._id } },
    options: { session },
  }]);
});

test('restoring a project requires its original contacts and an available enquiry', async t => {
  await t.test('missing contact', async t => {
    const { writes } = prepare(t);
    t.mock.method(Contact, 'countDocuments', () => ({ session: async () => 1 }));
    await assert.rejects(restoreProjectEnquiry(row, session), error => error.status === 409 && /client contacts/.test(error.message));
    assert.deepEqual(writes, []);
  });
  await t.test('enquiry linked elsewhere', async t => {
    prepare(t, { matchedCount: 0 });
    t.mock.method(Contact, 'countDocuments', () => ({ session: async () => 2 }));
    await assert.rejects(restoreProjectEnquiry(row, session), error => error.status === 409 && /enquiry is no longer available/.test(error.message));
  });
});
