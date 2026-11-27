const test = require('node:test');
const assert = require('node:assert/strict');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Event = require('../models/Event');
const Photographer = require('../models/Photographer');
const workers = require('../saas/workers');
const gate = require('../services/studioArchiveGate');
const { initCronJobs, sendEventNotification } = require('../services/ReminderService');
const { runInWorkspace, workspaceDatabase } = require('../saas/tenantContext');

test('failed legacy reminder reports failure after attempting other crew and does not send commercial tenant mail', async t => {
  const storedEnv = { EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS, TZ: process.env.TZ };
  Object.assign(process.env, { EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'fixture', TZ: 'UTC' });
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2028-02-28T18:35:00Z') });
  t.after(() => {
    for (const [key, value] of Object.entries(storedEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const recipients = ['first@example.test', 'second@example.test'];
  const sent = [], messages = [], logs = [];
  const event = { title: '<Private fixture title>', teamMembers: ['First', 'Second', 'Ambiguous', 'Inactive'], start: new Date(), end: new Date() };
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
    ...recipients.map((email, index) => ({ email, name: event.teamMembers[index] })),
    { name: 'Ambiguous', email: 'same-one@example.test' },
    { name: 'Ambiguous', email: 'same-two@example.test' },
    { name: 'Inactive', email: 'inactive@example.test', status: 'Inactive' },
  ]);
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
  assert.doesNotMatch(logs.join(' '), /example\.test|private fixture|private SMTP/i);
});
