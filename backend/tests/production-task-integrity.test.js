const test = require('node:test');
const assert = require('node:assert/strict');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const { createProductionTask } = require('../utils/productionTask');
const lead = '507f1f77bcf86cd799430001';

test('linked task creation writes both records in the same transaction and rejects a missing parent', async t => {
  const session = {};
  t.mock.method(Task.db, 'transaction', work => work(session));
  t.mock.method(Lead, 'exists', async () => true);
  const task = { _id: '507f1f77bcf86cd799430002' };
  t.mock.method(Task, 'create', async ([values], options) => {
    assert.equal(options.session, session);
    assert.equal(values.lead, lead);
    return [task];
  });
  let matchedCount = 1;
  t.mock.method(Lead, 'updateOne', async (filter, update, options) => {
    assert.equal(options.session, session);
    assert.deepEqual(filter, { _id: lead });
    assert.deepEqual(update, { $addToSet: { tasks: task._id } });
    return { matchedCount };
  });
  assert.equal(await createProductionTask({ title: 'Editing', lead }), task);
  matchedCount = 0;
  await assert.rejects(createProductionTask({ title: 'Editing', lead }), { status: 400 });
});

test('an unassigned task does not require a multi-document transaction', async t => {
  t.mock.method(Task.db, 'transaction', () => assert.fail('Unexpected transaction'));
  t.mock.method(Task, 'create', async values => values);
  assert.equal((await createProductionTask({ title: 'Pack camera' })).lead, null);
});
