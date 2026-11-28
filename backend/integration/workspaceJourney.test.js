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
const { MongoClient, ObjectId } = require('mongoose').mongo;

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
  const credentials = { JWT_SECRET: randomBytes(32).toString('hex'), BACKUP_SECRET: randomBytes(32).toString('hex'), VAULT_SECRET: randomBytes(32).toString('base64') };
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
  async function startApp({ writeFence = true } = {}) {
    service = fork(path.join(__dirname, 'workspaceJourneyServer.js'), [String(port)], { execArgv: [], env: {
      NODE_ENV: 'test', SAAS_ENABLED: 'true', SAAS_SIGNUP_ENABLED: 'true', ...credentials,
      STUDIO_JOURNEY_WRITE_FENCE: String(writeFence),
      FRONTEND_URL: 'http://127.0.0.1', PUBLIC_FRONTEND_URL: 'http://127.0.0.1',
      API_PUBLIC_URL: 'http://127.0.0.1',
      SAAS_GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
      SAAS_GOOGLE_CLIENT_SECRET: 'local-fixture-only',
      SAAS_GOOGLE_REDIRECT_URI: 'http://127.0.0.1/api/saas/oauth/google/callback',
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
    const password = randomBytes(20).toString('hex');
    const auth = await request('POST', '/saas/signup', null, { firstName: name, lastName: 'Test', studioName: name,
      email: name.toLowerCase() + '@example.test', password }, 201);
    const { token } = auth;
    await request('GET', '/leads', token, null, 409);
    for (const step of [1, 2]) await request('PATCH', '/saas/setup', token, { step, details: {} });
    await request('POST', '/saas/setup/complete', token, { details: {} });
    return { ...auth, password };
  }
  await startMongo(true);
  // The legacy gallery journey uses its existing route-level fixtures. The
  // commercial reset journey runs with the model fence installed as in production.
  await startApp({ writeFence: false });
  await require('./legacyGalleryJourney')(t, port, credentials.JWT_SECRET, request);
  await stop(service);
  await startApp();
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
  await t.test('assistant credentials and Gmail readiness stay scoped to each commercial studio', async () => {
    const assistants = '/integrations/assistants';
    const status = async current => (await request('GET', assistants + '/status', current)).providers;
    const openai = rows => rows.find(row => row.id === 'openai');
    assert.deepEqual((await status(token)).map(row => row.id).sort(), ['claude', 'openai']);
    assert.equal((await request('GET', '/integrations/gmail/status', token)).connected, false);
    await request('GET', '/integrations/gmail/status', editor.token, null, 403);
    await request('GET', assistants + '/status', editor.token, null, 403);
    await request('GET', '/integrations/whatsapp/status', token, null, 409);
    const setup = async (current, model) => {
      const apiKey = 'fixture-key-for-' + model;
      const saved = await request('POST', assistants + '/openai/connection', current, { model, apiKey });
      assert.equal(saved.configured, true);
      assert.equal(JSON.stringify(saved).includes(apiKey), false);
    };
    await setup(token, 'north-model');
    assert.equal(openai(await status(b.token)).configured, false);
    await setup(b.token, 'south-model');
    assert.equal(openai(await status(token)).model, 'north-model');
    assert.equal(openai(await status(b.token)).model, 'south-model');
    const draft = { task: 'reply', tone: 'professional', context: 'Confirm the sample project is ready for review.', consent: true };
    for (const [current, model] of [[token, 'north-model'], [b.token, 'south-model']]) {
      const result = await request('POST', assistants + '/openai/draft', current, draft);
      assert.equal(result.draft, 'A local draft from ' + model);
    }
    await request('DELETE', assistants + '/openai/connection', token);
    assert.equal(openai(await status(token)).configured, false);
    assert.equal(openai(await status(b.token)).configured, true);
  });
  await t.test('Gmail uses the existing Google callback with separate scoped browser proof', async () => {
    const gmail = '/integrations/gmail';
    const readiness = await request('GET', gmail + '/status', token);
    assert.equal(readiness.configured, true);
    assert.equal(readiness.connected, false);
    const { url } = await request('POST', gmail + '/connect', token, {});
    const begin = new URL(url);
    assert.equal(begin.pathname, '/api/integrations/gmail/begin');
    assert.match(begin.searchParams.get('ticket'), new RegExp('^gmail\\.' + a.user.workspace.id + '\\.[a-f0-9]{64}$'));

    // The provider URL is inspected only. The fixture sends no request to Google.
    const begun = await fetch(origin + begin.pathname + begin.search, { redirect: 'manual' });
    assert.equal(begun.status, 302);
    const destination = new URL(begun.headers.get('location'));
    assert.equal(destination.origin, 'https://accounts.google.com');
    assert.equal(destination.searchParams.get('redirect_uri'), 'http://127.0.0.1/api/saas/oauth/google/callback');
    assert.equal(destination.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
    assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
    const cookie = begun.headers.getSetCookie()[0].split(';')[0];
    assert.ok(cookie.startsWith('sx_gmail_oauth_' + a.user.workspace.id + '='));
    const params = new URLSearchParams({ state: destination.searchParams.get('state'), error: 'access_denied' });
    const urlFor = path => origin + path + '?' + params;
    const noProof = await fetch(urlFor('/api/saas/oauth/google/callback'), { redirect: 'manual' });
    assert.equal(noProof.status, 302);
    assert.equal(noProof.headers.get('location'), 'http://127.0.0.1/admin/email?gmail=error&step=state');
    assert.equal(noProof.headers.getSetCookie().length, 0);
    const cancelled = await fetch(urlFor('/api/saas/oauth/google/callback'), { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(cancelled.status, 302);
    assert.equal(cancelled.headers.get('location'), 'http://127.0.0.1/admin/email?gmail=error&step=state');
    assert.ok(cancelled.headers.getSetCookie().some(value => value.startsWith(cookie.split('=')[0] + '=;')));
    assert.equal((await request('GET', gmail + '/status', token)).hasConnection, false);
    assert.equal((await request('GET', gmail + '/status', b.token)).hasConnection, false);
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
  await t.test('contact, enquiry, project and crew deletion use tenant recovery and preserve linked records', async () => {
    const recovery = '/studio/security/recovery';
    const restore = async (model, recordId) => {
      const records = await request('GET', recovery, token);
      const item = records.find(record => record.model === model && record.recordId === recordId);
      assert.ok(item, model + ' in Recovery bin');
      await request('POST', recovery + '/' + item._id + '/restore', token, { confirmation: 'RESTORE RECORD' });
    };

    const contact = await request('POST', '/contacts', token, { firstName: 'Temporary', lastName: 'Client', email: 'temporary@example.test' }, 201);
    const contactPath = '/contacts/' + contact._id;
    const project = await request('POST', '/studio-projects', token, { name: 'Temporary project', contactId: contact._id }, 201);
    const projectPath = '/studio-projects/' + project._id;
    const enquiryPath = '/leads/' + project.leadId;
    await request('DELETE', contactPath, token, null, 409);
    await request('DELETE', projectPath, editor.token, null, 403);
    await request('DELETE', projectPath, token);
    await request('GET', projectPath, token, null, 404);
    assert.ok(!(await tenantDB.collection('leads').findOne({ _id: new ObjectId(project.leadId) })).studioProjectId);
    await restore('StudioProject', project._id);
    assert.equal((await request('GET', projectPath, token)).project._id, project._id);
    assert.equal(String((await tenantDB.collection('leads').findOne({ _id: new ObjectId(project.leadId) })).studioProjectId), project._id);
    await request('DELETE', projectPath, token);

    const work = await request('POST', enquiryPath + '/tasks', token, { title: 'Keep linked task' });
    await request('DELETE', enquiryPath, token, null, 409);
    await request('DELETE', '/tasks/' + work._id, token);
    await request('DELETE', enquiryPath, token);
    await restore('Lead', project.leadId);
    assert.ok((await request('GET', '/leads', token)).some(row => row._id === project.leadId));
    await request('DELETE', enquiryPath, token);
    await request('DELETE', contactPath, b.token, null, 404);
    await request('DELETE', contactPath, token);
    await request('GET', contactPath, token, null, 404);
    await restore('StudioContact', contact._id);
    assert.equal((await request('GET', contactPath, token)).contact.email, contact.email);
    await request('DELETE', contactPath, token);

    const crew = await request('POST', '/photographers', token, { name: 'Temporary Crew', email: 'temporary-crew@example.test', specialty: 'LEAD PHOTOGRAPHER' }, 201);
    const crewPath = '/photographers/' + crew._id;
    const sessionPath = '/calendar/' + secondSlot._id;
    await request('PATCH', sessionPath, token, { teamMembers: ['Temporary Crew'] });
    await request('DELETE', crewPath, token, null, 409);
    await request('DELETE', crewPath, editor.token, null, 403);
    await request('PATCH', sessionPath, token, { teamMembers: ['Sample Crew'] });
    await request('DELETE', crewPath, token);
    await restore('Photographer', crew._id);
    assert.ok((await request('GET', '/photographers', token)).some(row => row._id === crew._id));
    await request('DELETE', crewPath, token);
  });
  await t.test('contact deletion cannot race a project creation referencing that contact', async () => {
    const contact = await request('POST', '/contacts', token, { firstName: 'Concurrent', email: 'concurrent@example.test' }, 201);
    const contactPath = '/contacts/' + contact._id;
    const paused = once(service, 'message');
    const creating = fetch(origin + '/api/studio-projects', {
      method: 'POST',
      headers: { 'x-auth-token': token, 'Content-Type': 'application/json', 'x-journey-pause': 'project-create' },
      body: JSON.stringify({ name: 'Concurrent project', contactId: contact._id }),
    });
    try {
      const [signal] = await Promise.race([paused, creating.then(() => assert.fail('Project creation did not pause'))]);
      assert.equal(signal, 'project-create-ready');
      const busy = await request('DELETE', contactPath, token, null, 409);
      assert.match(busy.error, /studio work is still running/i);
      assert.equal((await request('GET', contactPath, token)).contact._id, contact._id);
    } finally {
      service.send('continue');
    }
    const created = await creating;
    assert.equal(created.status, 201);
    const project = await created.json();
    const linked = await request('DELETE', contactPath, token, null, 409);
    assert.match(linked.error, /linked records/i);
    assert.equal((await request('GET', '/studio-projects/' + project._id, token)).project._id, project._id);
    await request('DELETE', '/studio-projects/' + project._id, token);
    await request('DELETE', '/leads/' + project.leadId, token);
    await request('DELETE', contactPath, token);
  });
  await t.test('Start fresh deletes only the active studio and requires the owner to complete setup again', async () => {
    const resetPath = '/saas/workspace/reset';
    const registry = db.db('audit_registry');
    const ownerAccount = { email: a.user.email, password: a.password };
    const otherOwnerSession = await request('POST', '/saas/login', null, ownerAccount);
    const pending = await request('POST', '/saas/invitations', token, { email: 'pending@example.test', role: 'admin' }, 201);
    const pendingCode = new URL(pending.acceptUrl).pathname.split('/').pop();
    const before = await request('GET', '/saas/workspace', token);
    assert.equal(before.seats.used, 2);
    assert.equal(before.seats.reserved, 1);
    await request('POST', '/integrations/assistants/openai/connection', token, { apiKey: 'fixture-key-for-north-model', model: 'north-model' });

    await request('GET', resetPath, editor.token, null, 403);
    const readiness = await request('GET', resetPath, token);
    assert.equal(readiness.eligible, true);
    assert.equal(readiness.requiresPassword, true);
    const confirmation = { revision: readiness.revision, confirmation: 'DELETE WORKSPACE DATA', password: a.password };

    await request('POST', resetPath, editor.token, confirmation, 403);
    await request('POST', resetPath, token, { ...confirmation, confirmation: 'DELETE' }, 400);
    const invalidPassword = await request('POST', resetPath, token, { ...confirmation, password: 'incorrect-local-password' }, 401);
    assert.equal(invalidPassword.code, 'WORKSPACE_RESET_PASSWORD_INVALID');
    assert.equal((await request('GET', '/leads', token)).length, 1);
    assert.equal((await request('GET', publicPath)).status, 'Accepted');

    const backupTeamAccount = await registry.collection('saasaccounts').findOne({ email: 'editor@example.test' });
    assert.ok(backupTeamAccount);
    // Force the default profile insert to fail after deletions have begun.
    await tenantDB.command({ collMod: 'studioconfigs', validator: { studioName: { $ne: before.workspace.name } } });
    try {
      await request('POST', resetPath, token, confirmation, 503);
      assert.equal((await request('GET', resetPath, token)).revision, readiness.revision);
      assert.equal((await request('GET', '/leads', token)).length, 1);
      assert.equal((await request('GET', publicPath)).status, 'Accepted');
      assert.equal((await request('GET', '/saas/workspace', token)).seats.used, 2);
    } finally {
      await tenantDB.command({ collMod: 'studioconfigs', validator: {} });
    }
    const result = await request('POST', resetPath, token, confirmation);
    assert.equal(result.setupRequired, true);
    const setup = await request('GET', '/saas/setup', token);
    assert.equal(setup.step, 1);
    assert.equal(setup.workspace.setupRequired, true);
    assert.equal(setup.details.email, a.user.email);
    assert.equal(setup.workspace.id, a.user.workspace.id);
    assert.equal(setup.workspace.planId, before.workspace.planId);
    assert.equal(setup.workspace.subscriptionStatus, before.workspace.subscriptionStatus);

    for (const name of ['leads', 'studioprojects', 'studiocontacts', 'tasks', 'invoices', 'notifications', 'recoveryrecords', 'studioassistantconnections']) {
      assert.equal(await tenantDB.collection(name).countDocuments(), 0, name);
    }
    assert.ok(await registry.collection('saasaccounts').findOne({ _id: backupTeamAccount._id }));
    await request('GET', '/leads', token, null, 409);
    await request('GET', '/saas/setup', otherOwnerSession.token, null, 401);
    await request('GET', '/leads', editor.token, null, 401);
    await request('GET', '/saas/invitations/' + pendingCode, null, null, 404);
    await request('GET', publicPath, null, null, 404);
    assert.equal((await request('GET', '/calendar', b.token)).length, 1);
    const secondAssistant = (await request('GET', '/integrations/assistants/status', b.token)).providers;
    assert.equal(secondAssistant.find(provider => provider.id === 'openai').model, 'south-model');

    for (const step of [1, 2]) await request('PATCH', '/saas/setup', token, { step, details: {}, revision: setup.revision });
    await request('POST', '/saas/setup/complete', token, { details: {}, revision: setup.revision });
    assert.deepEqual(await request('GET', '/leads', token), []);
    assert.deepEqual(await request('GET', '/calendar', token), []);
    assert.equal((await request('GET', preferencesPath, token)).preferences.colorTheme, 'default');
    const after = await request('GET', '/saas/workspace', token);
    assert.equal(after.seats.used, 1);
    assert.equal(after.seats.reserved, 0);
    const newLead = await request('POST', '/leads', token, { name: 'New Sample Client', email: 'new@example.test', eventType: 'Wedding' });
    const staleReset = await request('POST', resetPath, token, confirmation, 409);
    assert.equal(staleReset.code, 'WORKSPACE_RESET_STALE');
    assert.deepEqual((await request('GET', '/leads', token)).map(lead => lead._id), [newLead._id]);
    const login = await request('POST', '/saas/login', null, ownerAccount);
    assert.equal(login.user.id, a.user.id);
    assert.ok(login.user.workspaceDataVersion > 0);
  });
});
