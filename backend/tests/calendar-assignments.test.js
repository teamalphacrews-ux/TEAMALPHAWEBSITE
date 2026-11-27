const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../models/Event');
const Reminder = require('../services/ReminderService');
const Google = require('../services/googleCalendarService');

test('calendar edit preserves the commit and announces only new crew when Google is unavailable', async t => {
  const assigned = [], broadcasts = [];
  let syncCalls = 0;
  t.mock.method(Reminder, 'sendEventNotification', async (_event, names) => assigned.push([...names]));
  t.mock.method(Google, 'syncToGoogle', async () => { syncCalls++; throw new Error('fixture outage'); });

  const router = require('../routes/calendarRoutes');
  const edit = router.stack.find(layer => layer.route?.path === '/:id' && layer.route.methods.patch).route.stack[0].handle;
  const row = new Event({ title: 'Sample', start: new Date('2028-02-29T10:00:00Z'), end: new Date('2028-02-29T11:00:00Z'), teamMembers: ['One'], __v: 0 });
  t.mock.method(Event, 'findById', async () => new Event(row.toObject()));
  t.mock.method(Event.db, 'transaction', callback => callback({}));
  t.mock.method(require('../models/StudioOperationLease'), 'updateOne', async () => ({}));
  t.mock.method(Event, 'find', () => ({ session: () => ({ select: () => ({ lean: async () => [] }) }) }));
  t.mock.method(Event, 'findOneAndUpdate', async (filter, update) => {
    if (filter.__v !== row.__v) return null;
    row.set(update.$set);
    return row;
  });
  const send = async body => {
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; } };
    await edit({ body, params: { id: row.id }, user: { id: 'sample' }, io: { to: () => ({ emit: (...event) => broadcasts.push(event) }) } }, res);
    return res;
  };
  const first = await send({ teamMembers: ['One', 'Two'] });
  assert.equal(first.statusCode, 200);
  assert.deepEqual([...first.data.teamMembers], ['One', 'Two']);
  assert.match(first.data.syncWarning, /updated/i);
  assert.deepEqual(assigned, [['Two']]);
  assert.equal(broadcasts.length, 1);
  await send({ teamMembers: ['One', 'Two'] });
  assert.deepEqual(assigned, [['Two']]);

  const concurrent = await Promise.all([send({ title: 'Edit A' }), send({ description: 'Edit B' })]);
  assert.deepEqual(concurrent.map(res => res.statusCode).sort(), [200, 409]);
  assert.equal(syncCalls, 3);
});
