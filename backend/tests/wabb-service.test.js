const test = require('node:test');
const assert = require('node:assert/strict');
const { createWabbService, createWabbRequest, configuration, attemptDTO } = require('../services/wabbService');

const privateEnv = { WHATSAPP_PROVIDER: 'wabb', WABB_API_KEY: 'private-fixture-key-not-real', WABB_WORKSPACE_ID: '14282', WABB_PHONE_NUMBER: '+919800000000' };
const actor = '507f1f77bcf86cd799439011';
const input = { requestId: 'abcdef0123456789abcdef0123456789', phone: '+91 98000 00001', text: 'Your project smart link is ready.', replyWindowConfirmed: true, permissionConfirmed: true };
const clone = value => structuredClone(value);
function fixture() {
  let clock = new Date('2026-10-25T10:00:00Z'), sequence = 1, getFailure, postFailure, subscriber = { id: 123, phone: '+919800000001', full_name: 'Private client name' }, postResponse = {};
  const env = { ...privateEnv }, calls = [];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);
  const query = run => { const q = { select() { return q; }, then(resolve, reject) { try { return Promise.resolve(clone(run())).then(resolve, reject); } catch (failure) { return Promise.reject(failure).then(resolve, reject); } } }; return q; };
  function model(unique) {
    const rows = [];
    return {
      rows,
      findOne: filter => query(() => rows.find(row => matches(row, filter)) || null),
      findOneAndUpdate: (filter, update) => query(() => { let row = rows.find(item => matches(item, filter)); if (!row) { row = { _id: String(sequence++), ...filter }; rows.push(row); } Object.assign(row, clone(update.$set)); return row; }),
      create: async source => { if (rows.some(row => unique.every(key => row[key] === source[key]))) throw Object.assign(Error('duplicate'), { code: 11000 }); const row = { _id: String(sequence++), ...clone(source) }; rows.push(row); return clone(row); },
      updateOne: async (filter, update) => { const row = rows.find(item => matches(item, filter)); if (!row) return { matchedCount: 0 }; Object.assign(row, clone(update.$set)); return { matchedCount: 1 }; },
    };
  }
  const Connection = model(['key']), Attempt = model(['workspaceId', 'requestId']);
  const request = async options => {
    calls.push(clone(options));
    if (options.method === 'POST') { if (postFailure) throw postFailure; return clone(postResponse); }
    if (getFailure) throw getFailure;
    if (options.path === '/webhook/subscribers/') return { count: 0, results: [], next: 'https://untrusted.example/private', previous: null };
    return clone(subscriber);
  };
  const service = createWabbService({ Connection, Attempt, env, request, now: () => new Date(clock) });
  return { service, env, calls, Connection, Attempt, advance: ms => { clock = new Date(clock.getTime() + ms); }, time: () => new Date(clock), setSubscriber: value => { subscriber = value; }, setGetFailure: value => { getFailure = value; }, setPostFailure: value => { postFailure = value; }, setPostResponse: value => { postResponse = value; } };
}

test('explicit Wabb configuration is required and a verified key is never called a connected inbox', async () => {
  const f = fixture();
  for (const key of Object.keys(privateEnv)) assert.equal(configuration({ ...privateEnv, [key]: '' }).configured, false);
  assert.equal(configuration({ ...privateEnv, WABB_WORKSPACE_ID: '../14282' }).configured, false);
  assert.equal(configuration({ ...privateEnv, WABB_PHONE_NUMBER: '9800000000' }).configured, false);
  assert.equal(configuration({ ...privateEnv, WABB_API_KEY: 'short' }).configured, false);
  assert.equal((await f.service.status()).state, 'verification_needed');
  const result = await f.service.verifyConnection(actor);
  assert.equal(result.apiReady, true); assert.equal(result.connected, false); assert.equal(result.state, 'wabb_api_ready');
  assert.equal(result.dashboardUrl, 'https://console.wabb.in/14282/dashboard');
  assert.deepEqual(result.capabilities, { inbox: false, history: false, templates: false, deliveryReceipts: false, manualText: true });
  assert.equal(f.Connection.rows[0].coexistence, false); assert.equal(f.Connection.rows[0].state, 'api_verified');
  assert.equal(JSON.stringify(result).includes(privateEnv.WABB_API_KEY), false);
  assert.deepEqual(f.calls.map(call => [call.method, call.path]), [['GET', '/webhook/subscribers/']]);
  f.advance(86400000); assert.equal((await f.service.status()).apiReady, false);
});
test('credential and workspace changes invalidate verification without provider mutations', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); f.env.WABB_API_KEY += '-rotated';
  assert.equal((await f.service.status()).state, 'verification_needed');
  await assert.rejects(f.service.sendWabb(input, actor), { code: 'WHATSAPP_VERIFICATION_REQUIRED' });
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});
test('failed API verification sanitizes errors and never follows returned pagination links', async () => {
  const f = fixture(); f.setGetFailure(Error('Private provider body ' + privateEnv.WABB_API_KEY));
  await assert.rejects(f.service.verifyConnection(actor), failure => failure.code === 'WHATSAPP_WABB_VERIFICATION' && !failure.message.includes(privateEnv.WABB_API_KEY));
  const state = await f.service.status(); assert.equal(state.state, 'unavailable'); assert.equal(state.apiReady, false);
  assert.equal(JSON.stringify(state).includes('Private provider'), false); assert.equal(f.calls.length, 1);
});
test('both explicit contact permission and reply-window attestations are required', async () => {
  const f = fixture(); await f.service.verifyConnection(actor);
  for (const key of ['replyWindowConfirmed', 'permissionConfirmed']) await assert.rejects(f.service.sendWabb({ ...input, [key]: false }, actor), { code: 'WHATSAPP_WABB_CONFIRMATION' });
  assert.equal(f.calls.length, 1); assert.equal(f.Attempt.rows.length, 0);
});
test('only an existing exact international-phone subscriber can be messaged', async () => {
  for (const subscriber of [{ id: 123, phone: '9800000001' }, { id: 123, phone: '+919800000002' }, { id: 'malicious/path', phone: '+919800000001' }, { id: 123 }]) {
    const f = fixture(); await f.service.verifyConnection(actor); f.setSubscriber(subscriber);
    await assert.rejects(f.service.sendWabb(input, actor), { code: 'WHATSAPP_WABB_RECIPIENT_MISMATCH' });
    assert.equal(f.Attempt.rows.length, 0); assert.equal(f.calls.some(call => call.method === 'POST'), false);
  }
  const f = fixture(); await f.service.verifyConnection(actor); f.setGetFailure(Object.assign(Error('Private 404'), { httpStatus: 404 }));
  await assert.rejects(f.service.sendWabb(input, actor), { code: 'WHATSAPP_WABB_RECIPIENT_NOT_FOUND' });
  assert.ok(f.calls.every(call => call.method === 'GET'));
});
test('concurrent and uppercase retries submit once, while payload/key reuse conflicts', async () => {
  const f = fixture(); await f.service.verifyConnection(actor);
  const [first, again] = await Promise.all([f.service.sendWabb(input, actor), f.service.sendWabb({ ...input, requestId: input.requestId.toUpperCase() }, actor)]);
  assert.equal(first.attempt.id, again.attempt.id); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(first.attempt.status, 'submitted'); assert.equal(first.attempt.phone, '+919800000001');
  assert.deepEqual(Object.keys(first.attempt).sort(), ['createdAt', 'id', 'phone', 'status', 'text']);
  assert.equal(f.Attempt.rows[0].permissionConfirmed, true); assert.equal(f.Attempt.rows[0].replyWindowConfirmed, true);
  await assert.rejects(f.service.sendWabb({ ...input, text: 'Different text' }, actor), { code: 'WHATSAPP_REQUEST_CONFLICT' });
  f.env.WABB_API_KEY += '-changed'; await assert.rejects(f.service.sendWabb(input, actor), { code: 'WHATSAPP_REQUEST_CONFLICT' });
});
test('submission is durably claimed before POST and a failed claim never sends', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); f.Attempt.create = async () => { throw Error('Database down'); };
  await assert.rejects(f.service.sendWabb(input, actor), { code: 'WHATSAPP_WABB_STORAGE' });
  assert.equal(f.calls.some(call => call.method === 'POST'), false);
});
test('ambiguous network, 408, 5xx and malformed successes stay Unknown and never resubmit', async () => {
  const failures = [Error('Private timeout'), Object.assign(Error('Private timeout'), { httpStatus: 408 }), Object.assign(Error('Private server error'), { httpStatus: 503 }), Object.assign(Error('Ambiguous failure'), { httpStatus: 400, ambiguous: true })];
  for (const failure of failures) {
    const f = fixture(); await f.service.verifyConnection(actor); f.setPostFailure(failure);
    const result = await f.service.sendWabb(input, actor); assert.equal(result.attempt.status, 'unknown'); assert.match(result.attempt.error, /Check Wabb/); assert.equal(result.attempt.error.includes('Private'), false);
    await f.service.sendWabb(input, actor); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  }
  const f = fixture(); await f.service.verifyConnection(actor); f.setPostResponse({ success: false });
  assert.equal((await f.service.sendWabb(input, actor)).attempt.status, 'unknown');
});
test('definite 4xx rejection is Failed without leaking provider diagnostics', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); f.setPostFailure(Object.assign(Error('Private API-KEY invalid'), { httpStatus: 403 }));
  const result = await f.service.sendWabb(input, actor); assert.equal(result.attempt.status, 'failed'); assert.equal(result.attempt.error.includes('API-KEY'), false);
  await f.service.sendWabb(input, actor); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});
test('post-send storage failure is Unknown and the durable claim prevents a second POST', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); f.Attempt.updateOne = async () => { throw Error('Database unavailable'); };
  const first = await f.service.sendWabb(input, actor); assert.equal(first.attempt.status, 'unknown');
  await f.service.sendWabb(input, actor); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  f.advance(121000); const stale = await f.service.sendWabb(input, actor); assert.equal(stale.attempt.status, 'unknown'); assert.match(stale.attempt.error, /Check Wabb/);
  assert.equal(attemptDTO({ _id: 1, status: 'sending', phone: '+919800000001', text: 'Crash fixture', createdAt: 'invalid' }).status, 'unknown');
});
test('HTTP transport pins origin, headers, endpoints and redirects without exposing a provider configuration operation', async () => {
  const calls = [], request = createWabbRequest({ fetcher: async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 200 }); } });
  await request({ method: 'GET', path: '/webhook/subscribers/', query: { page: 1 }, key: privateEnv.WABB_API_KEY });
  await request({ method: 'POST', path: '/webhook/subscriber/123/send_message/', body: { type: 'text', value: 'Hello' }, key: privateEnv.WABB_API_KEY });
  assert.equal(calls[0].url, 'https://api.wabb.in/api/v1/webhook/subscribers/?page=1');
  assert.equal(calls[0].options.headers['API-KEY'], privateEnv.WABB_API_KEY); assert.equal(calls[0].options.redirect, 'error'); assert.ok(calls[0].options.signal);
  assert.deepEqual(JSON.parse(calls[1].options.body), { type: 'text', value: 'Hello' });
  for (const options of [{ path: 'https://evil.example/steal' }, { method: 'DELETE', path: '/webhook/subscriber/123/delete/' }, { method: 'POST', path: '/integrations/zapier/settings/14282/refresh_key/', body: {} }, { path: '/webhook/subscribers/', query: { page: 'https://evil.example' } }]) await assert.rejects(request({ key: privateEnv.WABB_API_KEY, ...options }), { code: 'WHATSAPP_CONFIGURATION' });
  await assert.rejects(request({ path: '/webhook/subscribers/', query: { page: 1 }, key: 'short' }), { code: 'WHATSAPP_CONFIGURATION' });
  assert.equal(calls.length, 2);
});
test('bounded UTF-8 streaming preserves Kannada and treats HTTP 408 as ambiguous', async () => {
  const name = 'ಟೀಮ್ ಆಲ್ಫಾ', bytes = Buffer.from(JSON.stringify({ name }));
  const request = createWabbRequest({ fetcher: async () => ({ status: 200, body: (async function* () { for (let index = 0; index < bytes.length; index++) yield bytes.subarray(index, index + 1); })() }) });
  assert.equal((await request({ path: '/webhook/subscriber/get_by_phone/919800000001/', key: privateEnv.WABB_API_KEY })).name, name);
  const timeout = createWabbRequest({ fetcher: async () => new Response('{}', { status: 408 }) });
  await assert.rejects(timeout({ method: 'POST', path: '/webhook/subscriber/123/send_message/', body: { type: 'text', value: 'Hello' }, key: privateEnv.WABB_API_KEY }), failure => failure.httpStatus === 408 && failure.ambiguous === true);
  const large = createWabbRequest({ fetcher: async () => ({ status: 200, body: (async function* () { yield Buffer.alloc(1024 * 1024 + 1); })() }) });
  await assert.rejects(large({ path: '/webhook/subscribers/', query: { page: 1 }, key: privateEnv.WABB_API_KEY }));
});
test('database schema keeps keys hidden and request IDs unique per workspace', () => {
  const Attempt = require('../models/WabbMessageAttempt'), Connection = require('../models/WhatsAppConnection');
  assert.equal(Attempt.schema.path('fingerprint').options.select, false); assert.equal(Attempt.schema.path('payloadHash').options.select, false); assert.equal(Attempt.schema.path('subscriberId').options.select, false);
  assert.ok(Attempt.schema.indexes().some(([keys, options]) => keys.workspaceId === 1 && keys.requestId === 1 && options.unique));
  assert.ok(Connection.schema.path('state').enumValues.includes('api_verified'));
});
