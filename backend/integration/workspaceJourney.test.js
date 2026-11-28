// STUDIO_AUDIT_MONGOD=/absolute/path/to/mongod node --test integration/workspaceJourney.test.js
// Creates its own loopback replica set and two synthetic studios. No existing DB URI is accepted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawn, fork } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { MongoClient } = require('mongoose').mongo;

async function unusedPort() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  server.close();
  await once(server, 'close');
  return port;
}
async function stop(child, signal) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  const exited = once(child, 'exit');
  if (signal) child.kill(signal);
  else child.disconnect();
  await exited;
}
test('commercial enquiry, project, task, quote, payment and recovery survive application and database restarts', {
  skip: process.env.STUDIO_AUDIT_MONGOD ? false : 'requires a local mongod executable', timeout: 90000,
}, async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-journey-'));
  const port = await unusedPort();
  const credentials = { JWT_SECRET: randomBytes(32).toString('hex'), BACKUP_SECRET: randomBytes(32).toString('hex') };
  const db = new MongoClient('mongodb://127.0.0.1:' + port + '/?directConnection=true', { serverSelectionTimeoutMS: 15000 });
  let mongo, service, origin;
  t.after(async () => {
    await stop(service);
    await db.close();
    await stop(mongo, 'SIGTERM');
    await rm(dir, { recursive: true, force: true });
  });
  async function startMongo(first) {
    mongo = spawn(process.env.STUDIO_AUDIT_MONGOD, ['--dbpath', dir, '--bind_ip', '127.0.0.1', '--port', String(port),
      '--replSet', 'studioAudit', '--logpath', path.join(dir, 'mongo.log'), '--logappend'], { stdio: 'ignore' });
    await once(mongo, 'spawn');
    await db.connect();
    const admin = db.db('admin');
    if (first) await admin.command({ replSetInitiate: { _id: 'studioAudit', members: [{ _id: 0, host: '127.0.0.1:' + port }] } });
    for (let n = 0; n < 120; n++) {
      if ((await admin.command({ hello: 1 })).isWritablePrimary) return;
      await delay(100);
    }
    assert.fail('disposable replica set did not elect a primary');
  }
  async function startApp() {
    service = fork(path.join(__dirname, 'workspaceJourneyServer.js'), [String(port)], { execArgv: [], env: {
      NODE_ENV: 'test', SAAS_ENABLED: 'true', SAAS_SIGNUP_ENABLED: 'true', ...credentials,
      FRONTEND_URL: 'http://127.0.0.1', PUBLIC_FRONTEND_URL: 'http://127.0.0.1',
    }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    const listenPort = await new Promise((resolve, reject) => {
      const failed = () => reject(new Error('HTTP fixture exited during startup'));
      service.once('exit', failed);
      service.once('message', value => { service.off('exit', failed); resolve(value); });
    });
    origin = 'http://127.0.0.1:' + listenPort;
  }
  const request = async (method, route, token, body, expected = 200) => {
    const response = await fetch(origin + '/api' + route, {
      method, headers: { ...(token && { 'x-auth-token': token }), 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    const description = route.replace(/(\/(?:quotes|invitations)\/)[^/]+/, '$1[link]');
    assert.equal(response.status, expected, method + ' ' + description + ' ' + (data.msg || data.error || ''));
    return data;
  };
  async function signUp(name) {
    const auth = await request('POST', '/saas/signup', null, { firstName: name, lastName: 'Test', studioName: name,
      email: name.toLowerCase() + '@example.test', password: randomBytes(20).toString('hex') }, 201);
    const { token } = auth;
    await request('GET', '/leads', token, null, 409);
    for (const step of [1, 2]) await request('PATCH', '/saas/setup', token, { step, details: {} });
    await request('POST', '/saas/setup/complete', token, { details: {} });
    return auth;
  }
  await startMongo(true);
  await startApp();
  await require('./legacyGalleryJourney')(t, port, credentials.JWT_SECRET, request);
  const a = await signUp('North'), b = await signUp('South');
  const token = a.token, tenantDB = db.db('studio_' + a.user.workspace.id);
  const invitation = await request('POST', '/saas/invitations', token, { email: 'editor@example.test', role: 'staff' }, 201);
  const inviteCode = new URL(invitation.acceptUrl).pathname.split('/').pop();
  const editor = await request('POST', '/saas/invitations/' + inviteCode + '/accept', null, {
    firstName: 'Sample', lastName: 'Editor', password: randomBytes(20).toString('hex'),
  });
  const preferencesPath = '/studio/preferences';
  await t.test('workspace palette stays private to each account and separate from display mode', async () => {
    const saved = await request('PATCH', preferencesPath, token, { colorTheme: 'rosso-corsa', theme: 'dark' });
    assert.equal(saved.preferences.colorTheme, 'rosso-corsa');
    assert.equal(saved.preferences.theme, 'dark');
    for (const otherToken of [b.token, editor.token]) {
      assert.equal((await request('GET', preferencesPath, otherToken)).preferences.colorTheme, 'default');
    }
    await request('PATCH', preferencesPath, token, { colorTheme: '#ff0000' }, 400);
    const system = await request('PATCH', preferencesPath, token, { theme: 'system' });
    assert.equal(system.preferences.colorTheme, 'rosso-corsa');
  });
  const booking = { title: 'Practice', start: '2028-02-29T08:00:00Z', end: '2028-02-29T09:00:00Z', teamMembers: ['Sample Crew'] };
  const reserve = values => fetch(origin + '/api/calendar', { method: 'POST',
    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(values),
  });
  const reservations = await Promise.all(Array.from({ length: 6 }, () => reserve(booking)));
  assert.deepEqual(reservations.map(response => response.status).sort(), [201, 409, 409, 409, 409, 409]);
  assert.equal((await request('GET', '/calendar', token)).length, 1);
  const secondSlot = await request('POST', '/calendar', token, {
    ...booking, start: booking.end, end: '2028-02-29T10:00:00Z',
  }, 201);
  await request('PATCH', '/calendar/' + secondSlot._id, token, { start: booking.start }, 409);
  assert.equal((await request('GET', '/calendar', token)).length, 2);
  await request('POST', '/calendar', b.token, booking, 201);
  const lead = await request('POST', '/leads', token, { name: 'Example Client', email: 'client@example.test', eventType: 'Wedding' });
  assert.equal((await request('GET', '/leads', b.token)).length, 0);
  const prepare = () => request('POST', '/leads/' + lead._id + '/project', token, {});
  const projects = await Promise.all([prepare(), prepare()]);
  assert.equal(projects[0].project._id, projects[1].project._id);
  assert.equal(await tenantDB.collection('studioprojects').countDocuments(), 1);
  assert.equal(await tenantDB.collection('studiocontacts').countDocuments(), 1);
  const task = await request('POST', '/leads/' + lead._id + '/tasks', token, { title: 'Edit images', clientVisible: true });
  await request('DELETE', '/tasks/' + task._id, token);
  const rawLead = () => tenantDB.collection('leads').findOne({ email: 'client@example.test' });
  assert.equal((await rawLead()).tasks.length, 0);
  const archived = await request('GET', '/studio/security/recovery', token);
  const archivedTask = archived.find(row => row.recordId === task._id);
  assert.ok(archivedTask);
  await request('POST', '/studio/security/recovery/' + archivedTask._id + '/restore', token, { confirmation: 'RESTORE RECORD' });
  assert.deepEqual((await rawLead()).tasks.map(String), [task._id]);
  assert.equal((await request('GET', '/tasks', editor.token)).some(row => row._id === task._id), true);
  const quote = await request('POST', '/studio/quotations', token, { title: 'Coverage', clientName: lead.name, email: lead.email,
    lead: lead._id, studioProjectId: projects[0].project._id, contactId: projects[0].lead.contactId,
    items: [{ title: 'Photography', quantity: 3, unitPricePaise: 10001 }], discountType: 'percent', discountValue: 10, taxRateBps: 1800 }, 201);
  assert.equal(quote.totalPaise, 31864);
  const shared = await request('POST', '/studio/quotations/' + quote._id + '/share', token, {});
  const publicPath = '/quotes/' + shared.token;
  const sent = await request('GET', publicPath);
  const accept = () => request('POST', publicPath + '/accept', null, { acceptedBy: 'Example Client', consent: true, revision: sent.revision });
  await Promise.all([accept(), accept()]);
  await accept();
  assert.equal(await tenantDB.collection('notifications').countDocuments({ eventKey: 'quote-accepted:' + quote._id }), 1);
  const inbox = memberToken => request('GET', '/notifications', memberToken);
  const acceptedNotice = (await inbox(token)).find(row => row.title === 'Quotation accepted');
  assert.ok(acceptedNotice);
  await t.test('reading and clearing acceptance activity is personal and workspace-scoped', async () => {
    const otherNotice = await request('POST', '/notifications/create', b.token, { title: 'South studio activity', type: 'System' });
    assert.equal(acceptedNotice.isRead, false);
    const read = await request('PATCH', '/notifications/' + acceptedNotice._id + '/read', token, {});
    assert.equal(read.isRead, true);
    assert.equal((await inbox(token)).find(row => row._id === acceptedNotice._id).isRead, true);
    assert.equal((await inbox(editor.token)).find(row => row._id === acceptedNotice._id).isRead, false);
    await request('DELETE', '/notifications/clear-all', token);
    assert.equal((await inbox(token)).length, 0);
    assert.equal((await inbox(editor.token)).find(row => row._id === acceptedNotice._id).isRead, false);
    const south = await inbox(b.token);
    assert.equal(south.find(row => row._id === otherNotice._id).isRead, false);
    assert.ok(south.every(row => row._id !== acceptedNotice._id));
  });
  const invoices = await request('GET', '/invoices', token);
  assert.equal(invoices.length, 1);
  let invoice = invoices[0];
  assert.equal(invoice.total, 318.64);
  assert.equal(String(invoice.studioProjectId), projects[0].project._id);
  assert.equal((await request('GET', '/invoices', b.token)).length, 0);
  invoice = await request('POST', '/invoices/' + invoice._id + '/approve', token, { editVersion: invoice.editVersion || 0 });
  const pay = async (amount, editVersion, expected = 200) => request('PUT', '/invoices/' + invoice._id, token,
    { advancePaid: amount, editVersion }, expected);
  invoice = await pay(80.25, invoice.editVersion);
  assert.equal(invoice.advancePaid, 80.25);
  await pay(99, invoice.editVersion - 1, 409);
  assert.equal((await request('GET', '/invoices/' + invoice._id, token)).advancePaid, 80.25);
  const register = async filter => (await request('GET', '/invoices/register?filter=' + filter, token)).rows;
  assert.equal((await register('outstanding'))[0].paymentStatus, 'Part paid');
  await stop(service);
  await db.close();
  await stop(mongo, 'SIGTERM');
  await startMongo(false);
  await startApp();
  const restoredPreferences = (await request('GET', preferencesPath, token)).preferences;
  assert.equal(restoredPreferences.colorTheme, 'rosso-corsa');
  assert.equal(restoredPreferences.theme, 'system');
  const saved = await request('GET', '/invoices/' + invoice._id, token);
  assert.ok(saved.documentNumber || saved.invoiceNumber);
  assert.equal(saved.documentNumber || saved.invoiceNumber, invoice.documentNumber || invoice.invoiceNumber);
  assert.equal(saved.advancePaid, 80.25);
  assert.equal(Math.round((saved.total - saved.advancePaid) * 100), 23839);
  assert.equal((await register('outstanding'))[0].balance, 238.39);
  assert.equal((await request('GET', '/invoices/' + invoice._id, editor.token)).advancePaid, 80.25);
  assert.equal((await rawLead()).tasks.map(String).includes(task._id), true);
  assert.equal((await request('GET', publicPath)).status, 'Accepted');
  await accept();
  assert.ok((await inbox(token)).every(row => row._id !== acceptedNotice._id));
  assert.equal((await inbox(editor.token)).find(row => row._id === acceptedNotice._id).isRead, false);
  assert.equal((await request('GET', '/invoices', token)).length, 1);
  assert.equal((await request('GET', '/invoices', b.token)).length, 0);
  const paid = await pay(318.64, saved.editVersion);
  assert.equal(paid.advancePaid, paid.total);
  const paidRows = await register('paid');
  assert.equal(paidRows.length, 1);
  assert.equal(paidRows[0].invoice._id, invoice._id);
  assert.equal(paidRows[0].paymentStatus, 'Paid');
  assert.equal(paidRows[0].balance, 0);
  await t.test('finance reports overlapping booking, invoice and ledger receipts separately', async () => {
    const recordedDate = new Date(paid.invoiceDate);
    const year = recordedDate.getUTCFullYear();
    const leadRecord = await rawLead();
    await tenantDB.collection('leads').updateOne({ _id: leadRecord._id }, {
      $set: { paymentStatus: 'Deposit Paid', totalAmount: 500, depositAmount: paid.total, createdAt: recordedDate },
    });
    const ledger = (amount, date, type, status) => request('POST', '/studio/ledger', token, {
      title: 'Sample transaction', category: type, amount, date, type, status,
    }, 201);
    const today = recordedDate.toISOString().slice(0, 10);
    const lastYear = (year - 1) + '-12-31';
    await ledger(paid.total, today, 'income', 'Received');
    await ledger(10.01, today, 'expense', 'Paid');
    await ledger(100, today, 'expense', 'Pending');
    await ledger(900, lastYear, 'income', 'Received');
    const read = (route, source, requestedYear = year, session = token) =>
      request('GET', '/finance/' + route + '?source=' + source + '&year=' + requestedYear, session);
    for (const source of ['invoices', 'bookings', 'ledger']) {
      const yearly = await read('overview', source);
      assert.equal(yearly.annualSales, 318.64);
      assert.equal(yearly.expenses, 10.01);
      assert.equal(yearly.annualProfit, source === 'ledger' ? 308.63 : null);
      const thisMonth = (await read('monthly-performance', source))[recordedDate.getUTCMonth()];
      assert.equal(thisMonth.revenue, 318.64);
      assert.equal(thisMonth.cashFlow, source === 'ledger' ? 308.63 : null);
      const income = (await read('transactions', source)).filter(row => row.type === 'income');
      assert.equal(income.length, 1);
      assert.equal(income[0].amount, 318.64);
    }
    assert.equal((await read('pending-payments', 'invoices')).length, 0);
    assert.equal((await read('pending-payments', 'bookings'))[0].pending, 181.36);
    assert.equal((await read('overview', 'ledger', year - 1)).annualSales, 900);
    assert.equal((await read('overview', 'invoices', year, b.token)).annualSales, 0);
  });
});
