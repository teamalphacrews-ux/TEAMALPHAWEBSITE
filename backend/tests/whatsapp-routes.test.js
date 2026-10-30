const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createWhatsAppRouter, MAX_WEBHOOK_BYTES } = require('../routes/whatsappRoutes');

const adminId = '507f1f77bcf86cd79943fa01', clientId = '507f1f77bcf86cd79943fa02', conversationId = '507f1f77bcf86cd79943fa03';
const signature = 'sha256=' + 'a'.repeat(64);
process.env.JWT_SECRET = 'whatsapp-routes-test-only';
test.beforeEach(require('./sessionFixture'));
test.beforeEach(t => { t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: id === adminId ? 'admin' : 'client', sessionVersion: 0 }) })); });

function fixture(overrides = {}) {
  const calls = [], service = {};
  for (const name of ['status', 'verifyConnection', 'listConversations', 'conversation', 'createConversation', 'send', 'templates', 'link', 'consent', 'markRead']) service[name] = async (...args) => { calls.push({ name, args }); return name === 'status' ? { configured: false, state: 'setup_needed' } : { operation: name }; };
  service.challenge = async values => { calls.push({ name: 'challenge', args: [values] }); return values['hub.challenge']; };
  service.receive = async (...args) => { calls.push({ name: 'receive', args }); return { processed: true }; };
  Object.assign(service, overrides.service);
  const wabbCalls = [], wabbService = {};
  for (const name of ['status', 'verifyConnection', 'sendWabb']) wabbService[name] = async (...args) => {
    wabbCalls.push({ name, args });
    return name === 'sendWabb' ? { attempt: { id: 'attempt-id', status: 'submitted' } } : { configured: true, connected: true, capabilities: { inbox: false, templates: false } };
  };
  Object.assign(wabbService, overrides.wabbService);
  const ownerCalls = [], verifyOwner = overrides.assertOwner || (async id => { ownerCalls.push(id); });
  const router = createWhatsAppRouter({ service, wabbService, env: overrides.env || {}, isOwner: overrides.isOwner || (async () => true), assertOwner: verifyOwner });
  return { router, service, calls, wabbService, wabbCalls, ownerCalls };
}
function dispatch(router, { method = 'GET', path = '/status', query = {}, body, role = 'admin', rawBody, headers = {} } = {}) {
  const bearer = role ? jwt.sign({ user: { id: role === 'admin' ? adminId : clientId, role } }, process.env.JWT_SECRET) : null;
  const requestHeaders = { ...(bearer ? { authorization: 'Bearer ' + bearer } : {}), ...headers };
  return new Promise((resolve, reject) => {
    const output = { status: 200, headers: {} };
    router.handle({ method, url: path, headers: requestHeaders, query, body, rawBody, header: name => requestHeaders[name.toLowerCase()] }, {
      set(name, value) { output.headers[name] = value; return this; },
      status(code) { output.status = code; return this; },
      type(value) { output.type = value; return this; },
      json(value) { output.body = value; resolve(output); return this; },
      send(value) { output.body = value; resolve(output); return this; },
    }, error => error ? reject(error) : resolve({ ...output, status: 404 }));
  });
}

test('WhatsApp inbox routes require a saved current administrator and keep authentication failures private', async () => {
  const f = fixture();
  for (const [role, status] of [[null, 401], ['client', 403]]) {
    const result = await dispatch(f.router, { role });
    assert.equal(result.status, status);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
  }
  assert.equal(f.calls.length, 0);
  const result = await dispatch(f.router);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { configured: false, state: 'setup_needed', provider: 'meta', owner: true });
});

test('status reports owner access from saved account checks rather than a provider payload', async () => {
  const f = fixture({ service: { status: async () => ({ connected: true, owner: true }) }, isOwner: async id => { assert.equal(id, adminId); return false; } });
  assert.deepEqual((await dispatch(f.router)).body, { connected: true, provider: 'meta', owner: false });
  const failed = fixture({ isOwner: async () => { throw Error('private database diagnostic'); } });
  const result = await dispatch(failed.router);
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /private|diagnostic|connected/);
});

test('owner verification is a separate empty request and never delegates after permission failure', async () => {
  const f = fixture({ assertOwner: async () => { throw Object.assign(new Error('private owner details'), { status: 403 }); } });
  const denied = await dispatch(f.router, { method: 'POST', path: '/verify', body: {} });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'WHATSAPP_OWNER');
  assert.doesNotMatch(denied.body.error, /private/);
  assert.equal(f.calls.length, 0);
  const allowed = fixture();
  assert.equal((await dispatch(allowed.router, { method: 'POST', path: '/verify', body: {} })).status, 200);
  assert.deepEqual(allowed.calls, [{ name: 'verifyConnection', args: [adminId] }]);
  for (const body of [{ token: 'secret' }, [], null]) assert.equal((await dispatch(allowed.router, { method: 'POST', path: '/verify', body })).status, 400);
  assert.equal(allowed.calls.length, 1);
});

test('public verification delegates a bounded numeric challenge without requiring a studio login', async () => {
  const f = fixture(), query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'private-test-token', 'hub.challenge': '123456' };
  const result = await dispatch(f.router, { role: null, path: '/webhook', query });
  assert.equal(result.status, 200);
  assert.equal(result.type, 'text/plain');
  assert.equal(result.body, '123456');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(f.calls, [{ name: 'challenge', args: [query] }]);
  for (const changed of [{ ...query, extra: 'x' }, { ...query, 'hub.challenge': '<script>' }, { ...query, 'hub.verify_token': { $ne: null } }, { ...query, 'hub.challenge': '1'.repeat(201) }]) assert.equal((await dispatch(f.router, { role: null, path: '/webhook', query: changed })).status, 400);
  assert.equal(f.calls.length, 1);
});

test('public signed delivery uses the exact raw bytes, never the parsed or user-substituted body', async () => {
  const f = fixture(), rawBody = Buffer.from('{ "object": "whatsapp_business_account" }');
  const result = await dispatch(f.router, { role: null, method: 'POST', path: '/webhook', rawBody, body: { private: 'not the verified bytes' }, headers: { 'content-type': 'application/json; charset=utf-8', 'x-hub-signature-256': signature } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { received: true });
  assert.equal(f.calls[0].name, 'receive');
  assert.strictEqual(f.calls[0].args[0], rawBody);
  assert.equal(f.calls[0].args[1], signature);
  assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
});

test('webhook shape, signature and byte limits reject requests before durable writes', async () => {
  const f = fixture(), valid = { role: null, method: 'POST', path: '/webhook', rawBody: Buffer.from('{}'), headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature } };
  const cases = [
    [{ headers: { 'content-type': 'application/json' } }, 401],
    [{ headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=wrong' } }, 401],
    [{ headers: { 'content-type': 'text/plain', 'x-hub-signature-256': signature } }, 415],
    [{ rawBody: undefined }, 400], [{ rawBody: '{}' }, 400], [{ rawBody: Buffer.alloc(0) }, 400],
    [{ rawBody: Buffer.alloc(MAX_WEBHOOK_BYTES + 1) }, 413], [{ query: { access_token: 'private' } }, 400],
  ];
  for (const [update, expected] of cases) assert.equal((await dispatch(f.router, { ...valid, ...update })).status, expected);
  assert.equal(f.calls.length, 0);
});

test('webhook signature or persistence failures never receive a successful acknowledgement or diagnostics', async () => {
  const valid = { role: null, method: 'POST', path: '/webhook', rawBody: Buffer.from('{}'), headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature } };
  const signatureFailure = fixture({ service: { receive: async () => { throw Object.assign(new Error('Signature did not match.'), { code: 'WHATSAPP_SIGNATURE', status: 401 }); } } });
  assert.equal((await dispatch(signatureFailure.router, valid)).status, 401);
  const databaseFailure = fixture({ service: { receive: async () => { throw Error('mongodb://private:password@database'); } } });
  const result = await dispatch(databaseFailure.router, valid);
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'WHATSAPP_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(result.body), /received|mongodb|password|database/);
});

test('inbox pagination accepts only bounded scalar filters and valid conversation identities', async () => {
  const f = fixture(), query = { q: 'client', unread: 'true', cursor: 'abc_DEF-123' };
  assert.equal((await dispatch(f.router, { path: '/conversations', query })).status, 200);
  assert.deepEqual(f.calls[0], { name: 'listConversations', args: [query] });
  assert.equal((await dispatch(f.router, { path: '/conversations/' + conversationId, query: { before: 'AbCd_123' } })).status, 200);
  assert.deepEqual(f.calls[1], { name: 'conversation', args: [conversationId, { before: 'AbCd_123' }] });
  for (const query of [{ q: { $regex: '.*' } }, { unread: true }, { unread: 'maybe' }, { cursor: '../secret' }, { q: 'a'.repeat(101) }, { limit: '10000' }]) assert.equal((await dispatch(f.router, { path: '/conversations', query })).status, 400);
  for (const id of ['null', 'not-a-record', '507f1f77bcf86cd79943fa0g']) assert.equal((await dispatch(f.router, { path: '/conversations/' + id })).status, 400);
  assert.equal(f.calls.length, 2);
});

test('message requests preserve retry identity and reject authority fields and type confusion', async () => {
  const f = fixture(), path = '/conversations/' + conversationId + '/messages', body = { requestId: 'b'.repeat(32), kind: 'text', text: 'Here is your project link.' };
  assert.equal((await dispatch(f.router, { method: 'POST', path, body })).status, 200);
  assert.deepEqual(f.calls[0], { name: 'send', args: [conversationId, body, adminId] });
  const template = { requestId: 'c'.repeat(32), kind: 'template', template: { name: 'project_update', language: 'en', parameters: ['Client', 'https://studio.example.test/quote/example'] } };
  assert.equal((await dispatch(f.router, { method: 'POST', path, body: template })).status, 200);
  assert.deepEqual(f.calls[1].args, [conversationId, template, adminId]);
  for (const body of [
    { requestId: 'b'.repeat(32), kind: 'text', text: { $ne: null } },
    { requestId: 'b'.repeat(32), kind: 'text', text: 'a'.repeat(4097) },
    { requestId: 'b'.repeat(32), kind: 'text', text: 'message', sender: adminId },
    { requestId: 'bad', kind: 'text', text: 'message' },
    { ...template, text: 'Different content' },
    { ...template, template: { ...template.template, approved: true } },
    { ...template, template: { ...template.template, parameters: [{ type: 'text', text: 'not a scalar' }] } },
    { ...template, template: { ...template.template, parameters: Array(21).fill('x') } },
    { requestId: 'b'.repeat(32), kind: 'image', text: 'unsupported' },
  ]) assert.equal((await dispatch(f.router, { method: 'POST', path, body })).status, 400);
  assert.equal(f.calls.length, 2);
});

test('message provider rejection stays an error and uncertain or accepted results pass through unchanged', async () => {
  const request = { method: 'POST', path: '/conversations/' + conversationId + '/messages', body: { requestId: 'd'.repeat(32), kind: 'text', text: 'Message' } };
  const rejected = fixture({ service: { send: async () => { throw Object.assign(new Error('The reply window has closed. Use an approved template.'), { status: 409, code: 'WHATSAPP_WINDOW' }); } } });
  assert.equal((await dispatch(rejected.router, request)).status, 409);
  for (const status of ['accepted', 'unknown']) {
    const row = { id: 'message-id', status, text: 'Message' }, f = fixture({ service: { send: async () => row } });
    assert.deepEqual((await dispatch(f.router, request)).body, row);
  }
  const failed = fixture({ service: { send: async () => { throw Object.assign(new Error('private-token'), { status: 500 }); } } });
  assert.doesNotMatch(JSON.stringify((await dispatch(failed.router, request)).body), /private-token/);
});

test('conversation creation, explicit record linking, permission evidence and local read state are bounded admin actions', async () => {
  const f = fixture(), actor = adminId;
  const operations = [
    ['POST', '/conversations', { phone: '+919876543210', name: 'Client' }, 'createConversation', null],
    ['PUT', '/conversations/' + conversationId + '/link', { entityType: 'contact', entityId: clientId }, 'link', conversationId],
    ['PUT', '/conversations/' + conversationId + '/consent', { confirmed: true, source: 'Client requested project updates at the consultation.' }, 'consent', conversationId],
    ['POST', '/conversations/' + conversationId + '/read', {}, 'markRead', conversationId],
  ];
  for (const [method, path, body, name, id] of operations) {
    const result = await dispatch(f.router, { method, path, body });
    assert.equal(result.status, name === 'createConversation' ? 201 : 200);
    assert.deepEqual(f.calls.at(-1), { name, args: name === 'markRead' ? [id, actor] : id ? [id, body, actor] : [body, actor] });
  }
  const invalid = [
    ['POST', '/conversations', { phone: { $ne: null } }],
    ['POST', '/conversations', { phone: '+919876543210', approved: true }],
    ['PUT', '/conversations/' + conversationId + '/link', { entityType: 'user', entityId: clientId }],
    ['PUT', '/conversations/' + conversationId + '/link', { entityType: 'contact', entityId: 'invalid' }],
    ['PUT', '/conversations/' + conversationId + '/consent', { confirmed: 'true', source: 'from client' }],
    ['PUT', '/conversations/' + conversationId + '/consent', { confirmed: true, source: 'from client', actorId: clientId }],
    ['POST', '/conversations/' + conversationId + '/read', { sendMetaReadReceipt: true }],
  ];
  for (const [method, path, body] of invalid) assert.equal((await dispatch(f.router, { method, path, body })).status, 400);
  assert.equal(f.calls.length, operations.length);
});

test('templates stay authenticated and unknown or provider failures never become empty successful lists', async () => {
  const f = fixture();
  assert.equal((await dispatch(f.router, { path: '/templates', role: null })).status, 401);
  assert.equal((await dispatch(f.router, { path: '/templates' })).status, 200);
  assert.equal(f.calls[0].name, 'templates');
  const unavailable = fixture({ service: { templates: async () => { throw Error('Bearer private-access-token'); } } });
  const result = await dispatch(unavailable.router, { path: '/templates' });
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /Bearer|private-access/);
});

test('selected Wabb status identifies its provider without claiming an inbox or templates', async () => {
  const f = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' }, isOwner: async id => { assert.equal(id, adminId); return false; },
    wabbService: { status: async () => ({ connected: true, configured: true, provider: 'untrusted-provider', owner: true, capabilities: { inbox: false, templates: false } }) } });
  const result = await dispatch(f.router);
  assert.deepEqual(result.body, { connected: true, configured: true, provider: 'wabb', owner: false, capabilities: { inbox: false, templates: false } });
  assert.equal(f.calls.length, 0);
  const meta = fixture({ env: { WHATSAPP_PROVIDER: 'meta' }, service: { status: async () => ({ provider: 'untrusted-provider', configured: false }) } });
  assert.equal((await dispatch(meta.router)).body.provider, 'meta');
  assert.equal(meta.wabbCalls.length, 0);
});

test('Wabb connection verification remains empty and owner-only', async () => {
  const f = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' } });
  const result = await dispatch(f.router, { method: 'POST', path: '/verify', body: {} });
  assert.equal(result.status, 200);
  assert.equal(result.body.provider, 'wabb');
  assert.equal(result.body.owner, true);
  assert.deepEqual(f.wabbCalls, [{ name: 'verifyConnection', args: [adminId] }]);
  assert.equal(f.calls.length, 0);
  for (const body of [{ token: 'private' }, [], null]) assert.equal((await dispatch(f.router, { method: 'POST', path: '/verify', body })).status, 400);
  assert.equal(f.wabbCalls.length, 1);
  const denied = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' }, assertOwner: async () => { throw Object.assign(Error('Private owner data'), { status: 403 }); } });
  assert.equal((await dispatch(denied.router, { method: 'POST', path: '/verify', body: {} })).status, 403);
  assert.equal(denied.wabbCalls.length, 0);
});

test('the public webhook always uses Meta HMAC processing regardless of selected provider', async () => {
  for (const provider of ['wabb', 'invalid-provider']) {
    const f = fixture({ env: { WHATSAPP_PROVIDER: provider } }), values = { 'hub.mode': 'subscribe', 'hub.verify_token': 'private-test-token', 'hub.challenge': '123' };
    assert.equal((await dispatch(f.router, { path: '/webhook', role: null, query: values })).body, '123');
    const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
    const result = await dispatch(f.router, { path: '/webhook', method: 'POST', role: null, rawBody, headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature } });
    assert.equal(result.status, 200);
    assert.equal(f.calls[0].name, 'challenge');
    assert.equal(f.calls[1].name, 'receive');
    assert.strictEqual(f.calls[1].args[0], rawBody);
    assert.equal(f.calls[1].args[1], signature);
    assert.equal(f.wabbCalls.length, 0);
    assert.equal((await dispatch(f.router, { path: '/webhook', method: 'POST', role: null, rawBody, headers: { 'content-type': 'application/json' } })).status, 401);
    assert.equal(f.calls.length, 2);
  }
});

test('Wabb cannot dispatch Meta-only conversations, templates, linking or read operations', async () => {
  const f = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' } });
  for (const [method, path] of [
    ['GET', '/conversations'], ['POST', '/conversations'], ['GET', '/conversations/' + conversationId],
    ['POST', '/conversations/' + conversationId + '/messages'], ['GET', '/templates'],
    ['PUT', '/conversations/' + conversationId + '/link'], ['PUT', '/conversations/' + conversationId + '/consent'],
    ['POST', '/conversations/' + conversationId + '/read'],
  ]) {
    const result = await dispatch(f.router, { method, path, body: {} });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'WHATSAPP_CAPABILITY');
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
    assert.equal(result.body.conversations, undefined);
    assert.equal(result.body.templates, undefined);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.wabbCalls.length, 0);
});

const validWabbBody = () => ({ requestId: 'e'.repeat(32), phone: '+919876543210', text: 'Your project update is ready.', replyWindowConfirmed: true, permissionConfirmed: true });

test('Wabb manual sending requires a saved administrator and exact confirmed scalar fields', async () => {
  const f = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' } }), request = { method: 'POST', path: '/wabb/messages', body: validWabbBody() };
  for (const [role, status] of [[null, 401], ['client', 403]]) {
    const result = await dispatch(f.router, { ...request, role });
    assert.equal(result.status, status);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
  }
  assert.equal(f.wabbCalls.length, 0);
  assert.deepEqual((await dispatch(f.router, request)).body, { attempt: { id: 'attempt-id', status: 'submitted' } });
  assert.deepEqual(f.wabbCalls, [{ name: 'sendWabb', args: [request.body, adminId] }]);
  assert.equal(f.calls.length, 0);
  const invalid = [
    [], null, {}, { ...validWabbBody(), requestId: 'bad' }, { ...validWabbBody(), requestId: ['e'.repeat(32)] },
    { ...validWabbBody(), phone: { $ne: null } }, { ...validWabbBody(), phone: 'x'.repeat(41) }, { ...validWabbBody(), phone: '+919876543210\n' },
    { ...validWabbBody(), text: ['message'] }, { ...validWabbBody(), text: 'x'.repeat(4097) }, { ...validWabbBody(), text: 'invalid\u0001message' },
    { ...validWabbBody(), replyWindowConfirmed: 'true' }, { ...validWabbBody(), permissionConfirmed: false },
    { ...validWabbBody(), accessToken: 'private' }, { ...validWabbBody(), actorId: clientId }, { ...validWabbBody(), subscriberId: '123' },
    { ...validWabbBody(), template: { name: 'unverified-template' } },
  ];
  for (const body of invalid) assert.equal((await dispatch(f.router, { ...request, body })).status, 400);
  assert.equal((await dispatch(f.router, { ...request, query: { token: 'private' } })).status, 400);
  assert.equal(f.wabbCalls.length, 1);
});

test('Wabb submission results and failures remain truthful and never expose private diagnostics', async () => {
  const request = { method: 'POST', path: '/wabb/messages', body: validWabbBody() };
  for (const status of ['submitted', 'unknown', 'failed']) {
    const result = { attempt: { id: 'attempt-id', status } }, f = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' }, wabbService: { sendWabb: async () => result } });
    assert.deepEqual((await dispatch(f.router, request)).body, result);
  }
  const rejection = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' }, wabbService: { sendWabb: async () => { throw Object.assign(Error('Recipient not found in Wabb.'), { status: 404, code: 'WHATSAPP_RECIPIENT_NOT_FOUND' }); } } });
  assert.equal((await dispatch(rejection.router, request)).status, 404);
  const failure = fixture({ env: { WHATSAPP_PROVIDER: 'wabb' }, wabbService: { sendWabb: async () => { throw Error('Bearer private-wabb-secret'); } } });
  const result = await dispatch(failure.router, request);
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /private-wabb-secret|Bearer|attempt/);
});

test('unknown provider configuration fails closed and Meta cannot invoke the Wabb sender', async () => {
  const request = { method: 'POST', path: '/wabb/messages', body: validWabbBody() }, meta = fixture();
  const disabled = await dispatch(meta.router, request);
  assert.equal(disabled.status, 409);
  assert.equal(disabled.body.code, 'WHATSAPP_CAPABILITY');
  assert.equal(meta.calls.length, 0); assert.equal(meta.wabbCalls.length, 0);
  const unknown = fixture({ env: { WHATSAPP_PROVIDER: 'unsupported' } });
  for (const options of [{}, { method: 'POST', path: '/verify', body: {} }, request, { path: '/templates' }, { path: '/conversations' }]) {
    const result = await dispatch(unknown.router, options);
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'WHATSAPP_CONFIGURATION');
  }
  assert.equal(unknown.calls.length, 0); assert.equal(unknown.wabbCalls.length, 0);
});
