const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Event = require('../models/Event');
const Photographer = require('../models/Photographer');
const StudioOperationLease = require('../models/StudioOperationLease');
const workers = require('../saas/workers');
const gate = require('../services/studioArchiveGate');
const { initCronJobs, sendEventNotification } = require('../services/ReminderService');
const { runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');

test('legacy reminder attempts each eligible recipient once across retries and skips commercial tenant mail', async t => {
  const storedEnv = { EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS, TZ: process.env.TZ };
  Object.assign(process.env, { EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'fixture', TZ: 'UTC' });
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2028-02-28T18:35:00Z') });
  t.after(() => {
    for (const [key, value] of Object.entries(storedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const recipients = ['first@example.test', 'second@example.test'];
  const sent = [], messages = [], logs = [], claims = new Map();
  const event = { _id: '1'.repeat(24), title: '<Private fixture title>', teamMembers: ['First', 'Second', 'Ambiguous', 'Inactive'], start: new Date(), end: new Date() };
  let scheduled, cronOptions, dateFilter;
  t.mock.method(cron, 'schedule', (spec, fn, options) => { assert.equal(spec, '0 8 * * *'); scheduled = fn; cronOptions = options; });
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async options => {
      sent.push(options.to); messages.push(options);
      if (options.to === recipients[0]) throw new Error('private SMTP diagnostic');
    },
  }));
  t.mock.method(Event, 'find', async query => { dateFilter = query; return [event]; });
  t.mock.method(Photographer, 'find', async () => [
    ...recipients.map((email, index) => ({ _id: String(index + 2).repeat(24), email, name: ['First', 'Second'][index] })),
    { _id: '4'.repeat(24), email: 'new-assignment@example.test', name: 'New assignment' },
    { name: 'Ambiguous', email: 'same-one@example.test' },
    { name: 'Ambiguous', email: 'same-two@example.test' },
    { name: 'Inactive', email: 'inactive@example.test', status: 'Inactive' },
  ]);
  t.mock.method(StudioOperationLease, 'updateOne', async ({ _id }, { $setOnInsert }, options) => {
    assert.deepEqual(options, { upsert: true, writeConcern: { w: 'majority' } });
    assert.match(_id, /^crew-reminder:[0-9a-f]{24}:[0-9a-f]{24}:\d{4}-/);
    if (claims.has(_id)) return { upsertedCount: 0 };
    claims.set(_id, $setOnInsert);
    return { upsertedCount: 1 };
  });
  t.mock.method(gate, 'withShared', async callback => callback());
  t.mock.method(workers, 'forEachWorkspace', async callback => callback());
  for (const level of ['log', 'error', 'warn']) t.mock.method(console, level, (...args) => logs.push(args.join(' ')));
  initCronJobs();
  await assert.rejects(scheduled(), /One or more crew reminder emails could not be sent/);
  assert.deepEqual(sent, recipients);
  assert.equal(cronOptions.timezone, 'Asia/Kolkata');
  // At this instant it is 00:05 on leap day in India, but still Feb 28 UTC.
  assert.equal(dateFilter.start.$gte.toISOString(), '2028-02-29T18:30:00.000Z');
  assert.equal(dateFilter.start.$lt.toISOString(), '2028-03-01T18:30:00.000Z');
  assert.match(messages[0].html, /00:05|12:05/);
  assert.match(messages[0].html, /&lt;Private fixture title&gt;/);
  const id = 'a'.repeat(24);
  await runInWorkspace({ _id: id, databaseName: workspaceDatabase(id) }, async () => {
    await scheduled();
    await sendEventNotification(event, event.teamMembers);
  });
  assert.deepEqual(sent, recipients);
  await sendEventNotification(event, event.teamMembers);
  assert.deepEqual(sent, [...recipients, ...recipients]);
  assert.match(messages.at(-1).html, /&lt;Private fixture title&gt;/);
  assert.equal(claims.size, 2);
  assert.ok([...claims.values()].every(claim => claim.expiresAt.toISOString() === '2028-03-01T18:30:00.000Z'));

  // Reinitializing transport is enough to lose any in-process state. The two
  // durable recipient claims still block a retry, including the ambiguous send.
  initCronJobs();
  event.teamMembers = ['First', 'Second', 'New assignment'];
  await Promise.all([scheduled(), scheduled()]);
  assert.deepEqual(sent, [...recipients, ...recipients, 'new-assignment@example.test']);
  assert.equal(claims.size, 3);

  // The same calendar event moving to the next reminder day gets a new claim.
  t.mock.timers.setTime(Date.parse('2028-02-29T18:35:00Z'));
  event.teamMembers = ['New assignment'];
  await scheduled();
  assert.deepEqual(sent.slice(-2), ['new-assignment@example.test', 'new-assignment@example.test']);
  assert.equal(claims.size, 4);
  assert.doesNotMatch(logs.join(' '), /example\.test|private fixture|private SMTP/i);
});
