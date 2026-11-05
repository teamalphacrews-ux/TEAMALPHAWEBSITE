const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createWhatsAppService, createGraphRequest, configuration, normalizePhone, templateProjection, verifySignature } = require('../services/whatsappService');
const actor = '507f1f77bcf86cd799439011';
const privateEnv = { WHATSAPP_ACCESS_TOKEN: 'private-test-access-token-never-output', WHATSAPP_APP_SECRET: 'private-test-app-secret-never-output', WHATSAPP_VERIFY_TOKEN: 'private-test-verify-token-never-output', WHATSAPP_PHONE_NUMBER_ID: '123456789012345', WHATSAPP_BUSINESS_ACCOUNT_ID: '987654321098765', WHATSAPP_GRAPH_VERSION: 'v42.0', API_PUBLIC_URL: 'https://api.example.test' };
const copy = value => structuredClone(value);
const compare = (a, b) => a === undefined || b === undefined ? a === b ? 0 : a === undefined ? -1 : 1 : a instanceof Date || b instanceof Date ? new Date(a).getTime() - new Date(b).getTime() : a > b ? 1 : a < b ? -1 : 0;
function fixture() {
  let sequence = 1, time = new Date('2026-10-25T10:00:00Z'), postFailure = null, coexists = true, phoneHook = null;
  const env = { ...privateEnv }, calls = [], stores = {};
  const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
  const expression = (row, value) => Array.isArray(value) ? value.map(item => expression(row, item)) : value && typeof value === 'object' && !(value instanceof Date) ? value.$ifNull ? expression(row, value.$ifNull[0]) ?? expression(row, value.$ifNull[1]) : value : typeof value === 'string' && value.startsWith('$') ? get(row, value.slice(1)) : value;
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(item => matches(row, item));
    if (key === '$and') return value.every(item => matches(row, item));
    if (key === '$expr') { const [a, b] = expression(row, value.$gt); return compare(a, b) > 0; }
    const current = get(row, key);
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([operator, operand]) => operator === '$exists' ? (current !== undefined) === operand : operator === '$in' ? operand.includes(current) : operator === '$gt' ? current !== undefined && compare(current, operand) > 0 : operator === '$gte' ? current !== undefined && compare(current, operand) >= 0 : operator === '$lt' ? current !== undefined && compare(current, operand) < 0 : operator === '$lte' ? current !== undefined && compare(current, operand) <= 0 : operator === '$regex' ? new RegExp(operand, value.$options || '').test(current || '') : operator === '$options');
    return compare(current, value) === 0;
  });
  const query = run => {
    let sorting, count;
    const q = { select() { return q; }, lean() { return q; }, sort(value) { sorting = value; return q; }, limit(value) { count = value; return q; }, then(resolve, reject) { try { let value = run(); if (Array.isArray(value)) { if (sorting) value.sort((a, b) => { for (const [key, order] of Object.entries(sorting)) { const result = compare(get(a, key), get(b, key)); if (result) return result * order; } return 0; }); if (count) value = value.slice(0, count); } return Promise.resolve(copy(value)).then(resolve, reject); } catch (failure) { return Promise.reject(failure).then(resolve, reject); } } }; return q;
  };
  function model(name, unique) {
    const rows = stores[name] = [];
    const enforce = (row, ignored) => { if (rows.some(item => item !== ignored && unique.some(keys => keys.every(key => row[key] !== undefined && item[key] === row[key])))) throw Object.assign(Error('Duplicate'), { code: 11000 }); };
    const change = (row, update, insert = false) => {
      const next = { ...row, ...(insert ? update.$setOnInsert : {}), ...update.$set };
      for (const [key, value] of Object.entries(update.$max || {})) if (next[key] === undefined || compare(value, next[key]) > 0) next[key] = value;
      enforce(next, row); Object.assign(row, copy(next)); return row;
    };
    return {
      rows,
      create: async source => { const row = { _id: (sequence++).toString(16).padStart(24, '0'), createdAt: new Date(time), ...copy(source) }; enforce(row); rows.push(row); return copy(row); },
      findOne: filter => query(() => rows.find(row => matches(row, filter)) || null),
      findById: id => query(() => rows.find(row => row._id === id) || null),
      find: filter => query(() => rows.filter(row => matches(row, filter))),
      countDocuments: async filter => rows.filter(row => matches(row, filter)).length,
      findOneAndUpdate: (filter, update, options = {}) => query(() => {
        let row = rows.find(row => matches(row, filter));
        if (!row && options.upsert) { row = { _id: filter._id || (sequence++).toString(16).padStart(24, '0'), createdAt: new Date(time), ...Object.fromEntries(Object.entries(filter).filter(([key, value]) => !key.startsWith('$') && (typeof value !== 'object' || value === null))) }; change(row, update, true); rows.push(row); return row; }
        return row ? change(row, update) : null;
      }),
      updateOne: async (filter, update) => { const row = rows.find(row => matches(row, filter)); if (!row) return { matchedCount: 0 }; change(row, update); return { matchedCount: 1 }; },
    };
  }
  const Connection = model('Connection', [['key']]), Conversation = model('Conversation', [['phoneNumberId', 'waId']]), Message = model('Message', [['phoneNumberId', 'providerId'], ['phoneNumberId', 'requestId']]), Receipt = model('Receipt', [['_id']]), Contact = model('Contact', [['_id']]), Lead = model('Lead', [['_id']]);
  const templateData = [{ name: 'studio_update', language: 'en', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hello {{1}}, your studio update is ready.' }] }];
  const request = async options => {
    calls.push(copy(options));
    if (options.path === env.WHATSAPP_BUSINESS_ACCOUNT_ID + '/phone_numbers') return { data: [{ id: env.WHATSAPP_PHONE_NUMBER_ID }] };
    if (options.path === env.WHATSAPP_PHONE_NUMBER_ID) { if (phoneHook) await phoneHook(); return { id: env.WHATSAPP_PHONE_NUMBER_ID, is_on_biz_app: coexists, display_phone_number: '+91 98000 00001', verified_name: 'Team Alpha' }; }
    if (options.path.endsWith('/message_templates')) return { data: copy(templateData) };
    if (options.method === 'POST' && options.path.endsWith('/messages')) { if (postFailure) throw postFailure; return { messages: [{ id: 'wamid.out-' + calls.filter(call => call.method === 'POST').length }] }; }
    throw Error('Unexpected request');
  };
  const service = createWhatsAppService({ Connection, Conversation, Message, Receipt, Contact, Lead, env, request, now: () => new Date(time) });
  const sign = body => { const raw = Buffer.from(JSON.stringify(body)); return [raw, 'sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(raw).digest('hex')]; };
  const payload = (values, field = 'messages') => ({ object: 'whatsapp_business_account', entry: [{ id: env.WHATSAPP_BUSINESS_ACCOUNT_ID, changes: [{ field, value: { metadata: { phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID }, ...values } }] }] });
  const inbound = (id = 'wamid.in-1', minutesAgo = 0, type = 'text') => payload({ contacts: [{ wa_id: '919800000001', profile: { name: 'Sample Client' } }], messages: [{ id, from: '919800000001', timestamp: String(Math.floor(time / 1000) - minutesAgo * 60), type, ...(type === 'text' ? { text: { body: 'Hello studio' } } : {}) }] });
  const receive = body => service.receive(...sign(body));
  const open = async () => { await service.verifyConnection(actor); await receive(inbound()); return Conversation.rows[0]._id; };
  return { service, env, calls, stores, Connection, Conversation, Message, Receipt, Contact, Lead, templateData, sign, payload, inbound, receive, open, time: () => new Date(time), advance: milliseconds => { time = new Date(time.getTime() + milliseconds); }, setCoexists: value => { coexists = value; }, setPostFailure: value => { postFailure = value; }, setPhoneHook: value => { phoneHook = value; } };
}

test('configuration requires six explicit backend fields and status never exposes secrets', async () => {
  const f = fixture();
  for (const key of Object.keys(privateEnv).filter(key => key.startsWith('WHATSAPP_'))) assert.equal(configuration({ ...privateEnv, [key]: '' }).configured, false);
  assert.equal(configuration({ ...privateEnv, WHATSAPP_GRAPH_VERSION: 'latest' }).configured, false);
  const state = await f.service.status(); assert.equal(state.state, 'verification_needed'); assert.equal(state.webhookUrl, 'https://api.example.test/api/integrations/whatsapp/webhook');
  assert.equal(JSON.stringify(state).includes(privateEnv.WHATSAPP_ACCESS_TOKEN), false);
  await f.service.verifyConnection(actor); assert.equal((await f.service.status()).connected, true);
  f.env.WHATSAPP_ACCESS_TOKEN += '-changed'; assert.equal((await f.service.status()).state, 'verification_needed');
});
test('verification is read-only and refuses to migrate a non-coexisting Business app', async () => {
  const f = fixture(); f.setCoexists(false);
  await assert.rejects(f.service.verifyConnection(actor), { code: 'WHATSAPP_COEXISTENCE_REQUIRED' });
  assert.equal((await f.service.status()).connected, false); assert.equal((await f.service.status()).state, 'coexistence_required');
  assert.ok(f.calls.every(call => call.method === 'GET')); assert.ok(f.calls.every(call => !/register|migrate|delete|deregister/.test(call.path)));
});
test('webhook challenge and signature reject wrong secrets, altered bytes and malformed bodies', async () => {
  const f = fixture(), challenge = { 'hub.mode': 'subscribe', 'hub.verify_token': f.env.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': '123456' };
  assert.equal(f.service.challenge(challenge), '123456');
  assert.throws(() => f.service.challenge({ ...challenge, 'hub.verify_token': 'wrong' }), { code: 'WHATSAPP_WEBHOOK_VERIFICATION' });
  const [raw, signature] = f.sign(f.inbound()); assert.equal(verifySignature(raw, signature, f.env.WHATSAPP_APP_SECRET), true);
  assert.equal(verifySignature(Buffer.concat([raw, Buffer.from(' ')]), signature, f.env.WHATSAPP_APP_SECRET), false);
  await assert.rejects(f.service.receive(raw, 'sha256=' + '0'.repeat(64)), { code: 'WHATSAPP_WEBHOOK_SIGNATURE' }); assert.equal(f.Message.rows.length, 0);
});
test('incoming messages are durable, deduplicated and never manufacture CRM contacts or enquiries', async () => {
  const f = fixture(), event = f.inbound(); await f.receive(event); await f.receive(event);
  assert.equal(f.Conversation.rows.length, 1); assert.equal(f.Message.rows.length, 1); assert.equal(f.Receipt.rows.length, 1);
  assert.equal(f.Contact.rows.length, 0); assert.equal(f.Lead.rows.length, 0);
  const list = await f.service.listConversations({ unread: 'true' }); assert.equal(list.conversations[0].unread, 1); assert.equal(list.conversations[0].name, 'Sample Client');
  await f.service.markRead(list.conversations[0].id, actor); assert.equal((await f.service.listConversations({ unread: 'true' })).conversations.length, 0);
});
test('receipt retries after partial storage failure complete without duplicate messages or unread counts', async () => {
  const f = fixture(), update = f.Receipt.updateOne; let fail = true;
  f.Receipt.updateOne = async (filter, change) => { if (change.$set?.done && fail) { fail = false; throw Error('Database unavailable'); } return update(filter, change); };
  await assert.rejects(f.receive(f.inbound())); assert.equal(f.Message.rows.length, 1);
  await f.receive(f.inbound()); assert.equal(f.Message.rows.length, 1); assert.equal((await f.service.listConversations()).conversations[0].unread, 1); assert.equal(f.Receipt.rows[0].done, true);
});
test('unsupported media stays text-only, system messages and Business app echoes do not open a reply window', async () => {
  const f = fixture(); await f.receive(f.inbound('wamid.media', 0, 'image'));
  assert.equal(f.Message.rows[0].kind, 'unsupported'); assert.match(f.Message.rows[0].text, /open WhatsApp Business/); assert.equal(f.calls.length, 0);
  const g = fixture(); await g.receive(g.inbound('wamid.system', 0, 'system')); assert.equal(g.Conversation.rows[0].lastInboundAt, undefined);
  await g.receive(g.payload({ message_echoes: [{ id: 'wamid.echo', to: '919800000001', from: '919800000099', timestamp: String(Math.floor(g.time() / 1000)), type: 'text', text: { body: 'Sent from the Business app' } }] }, 'smb_message_echoes'));
  assert.equal(g.Conversation.rows[0].lastInboundAt, undefined); assert.equal(g.Message.rows[1].direction, 'outbound');
});
test('old incoming retries never extend the 24-hour window and outbound text requires a real inbound message', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); const row = (await f.service.createConversation({ phone: '+919800000001' })).conversation;
  await assert.rejects(f.service.send(row.id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hi' }, actor), { code: 'WHATSAPP_WINDOW_CLOSED' });
  const old = f.inbound('wamid.old', 23 * 60); await f.receive(old); f.advance(2 * 3600000); await f.receive(old);
  await assert.rejects(f.service.send(row.id, { requestId: 'b'.repeat(32), kind: 'text', text: 'Hi' }, actor), { code: 'WHATSAPP_WINDOW_CLOSED' });
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});
test('outbound request IDs submit once and cannot be reused for different content', async () => {
  const f = fixture(), id = await f.open(), body = { requestId: 'a'.repeat(32), kind: 'text', text: 'Your smart link is ready.' };
  const first = await f.service.send(id, body, actor), again = await f.service.send(id, body, actor);
  assert.equal(first.message.id, again.message.id); assert.equal(first.message.status, 'submitted'); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  await assert.rejects(f.service.send(id, { ...body, text: 'Different content' }, actor), { code: 'WHATSAPP_REQUEST_CONFLICT' });
});
test('ambiguous POST failures and HTTP408 remain unknown and are never automatically resubmitted', async () => {
  for (const failure of [Error('Private provider diagnostic'), Object.assign(Error('HTTP timeout'), { httpStatus: 408 }), Object.assign(Error('Ambiguous rejection'), { httpStatus: 400, ambiguous: true })]) {
    const f = fixture(), id = await f.open(), body = { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }; f.setPostFailure(failure);
    const first = await f.service.send(id, body, actor); assert.equal(first.message.status, 'unknown'); assert.equal(first.message.error.includes('Private'), false);
    await f.service.send(id, body, actor); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
  }
});
test('concurrent retries and uppercase UUID spelling still produce one provider submission', async () => {
  const f = fixture(), id = await f.open(), body = { requestId: 'abcdef0123456789abcdef0123456789', kind: 'text', text: 'One message' };
  const [first, second] = await Promise.all([f.service.send(id, body, actor), f.service.send(id, { ...body, requestId: body.requestId.toUpperCase() }, actor)]);
  assert.equal(first.message.id, second.message.id); assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
});
test('definite provider rejection is failed, while a crashed Sending claim ages to Unknown on read', async () => {
  const f = fixture(), id = await f.open(); f.setPostFailure(Object.assign(Error('Private token error'), { httpStatus: 400 }));
  assert.equal((await f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }, actor)).message.status, 'failed');
  await f.Message.create({ phoneNumberId: f.env.WHATSAPP_PHONE_NUMBER_ID, conversation: id, waId: '919800000001', requestId: 'b'.repeat(32), payloadHash: 'hidden', direction: 'outbound', kind: 'text', text: 'Crash fixture', status: 'sending', createdAt: f.time() });
  f.advance(121000); const result = await f.service.conversation(id); assert.equal(result.messages.at(-1).status, 'unknown'); assert.match(result.messages.at(-1).error, /Check WhatsApp/);
});
test('delivery statuses advance monotonically even when concurrent and out of order', async () => {
  const f = fixture(), id = await f.open(); await f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }, actor);
  const status = value => f.payload({ statuses: [{ id: 'wamid.out-1', status: value, timestamp: String(Math.floor(f.time() / 1000)) }] });
  await Promise.all([f.receive(status('sent')), f.receive(status('delivered')), f.receive(status('read'))]);
  assert.equal(f.Message.rows.find(row => row.providerId === 'wamid.out-1').status, 'read');
  await f.receive(status('failed')); await f.receive(status('sent')); assert.equal(f.Message.rows.find(row => row.providerId === 'wamid.out-1').status, 'read');
});
test('orphan delivery receipts are retained and applied once the provider ID is bound', async () => {
  const f = fixture(), id = await f.open(); await f.receive(f.payload({ statuses: [{ id: 'wamid.out-1', status: 'read', timestamp: String(Math.floor(f.time() / 1000)) }] }));
  const result = await f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }, actor); assert.equal(result.message.status, 'read');
});
test('a delayed Sent receipt cannot hide a delivery failure, while Delivered is authoritative', async () => {
  const f = fixture(), id = await f.open(); await f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }, actor);
  const status = value => f.payload({ statuses: [{ id: 'wamid.out-1', status: value, timestamp: String(Math.floor(f.time() / 1000)) }] });
  await f.receive(status('failed')); await f.receive(status('sent')); assert.equal(f.Message.rows.find(row => row.providerId === 'wamid.out-1').status, 'failed');
  await f.receive(status('delivered')); assert.equal(f.Message.rows.find(row => row.providerId === 'wamid.out-1').status, 'delivered');
});
test('templates are currently approved, plain BODY-only and parameter-count validated', async () => {
  const f = fixture(); await f.service.verifyConnection(actor);
  f.templateData.push({ ...f.templateData[0], name: 'pending', status: 'PENDING' }, { ...f.templateData[0], name: 'media', components: [{ type: 'HEADER', format: 'IMAGE' }, ...f.templateData[0].components] }, { ...f.templateData[0], name: 'named', parameter_format: 'NAMED' });
  assert.equal((await f.service.templates()).templates.length, 1);
  assert.equal(templateProjection({ ...f.templateData[0], components: [{ type: 'BODY', text: 'Hello {{2}}' }] }), null);
  assert.equal(templateProjection({ ...f.templateData[0], components: [{ type: 'BODY', text: 'Hello {{name}}' }] }), null);
});
test('starting outside the reply window needs recorded opt-in and approved template', async () => {
  const f = fixture(); await f.service.verifyConnection(actor); const { conversation } = await f.service.createConversation({ phone: '+919800000001' });
  const body = { requestId: 'c'.repeat(32), kind: 'template', template: { name: 'studio_update', language: 'en', parameters: ['Sample'] } };
  await assert.rejects(f.service.send(conversation.id, body, actor), { code: 'WHATSAPP_OPT_IN_REQUIRED' });
  await f.service.consent(conversation.id, { confirmed: true, source: 'Client requested WhatsApp updates by email.' }, actor);
  const result = await f.service.send(conversation.id, body, actor); assert.equal(result.message.kind, 'template'); assert.equal(result.message.text, 'Hello Sample, your studio update is ready.');
  assert.equal(f.calls.find(call => call.method === 'POST').body.template.components[0].parameters[0].text, 'Sample');
});
test('reply window and consent are rechecked after slow provider reads', async () => {
  const f = fixture(), id = await f.open(); f.advance(23 * 3600000 + 59 * 60000);
  f.setPhoneHook(async () => { f.advance(120000); });
  await assert.rejects(f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Too late' }, actor), { code: 'WHATSAPP_WINDOW_CLOSED' });
  assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});
test('a changed coexistence state blocks sending and leaves the Business app untouched', async () => {
  const f = fixture(), id = await f.open(); f.setCoexists(false);
  await assert.rejects(f.service.send(id, { requestId: 'a'.repeat(32), kind: 'text', text: 'Hello' }, actor), { code: 'WHATSAPP_COEXISTENCE_REQUIRED' }); assert.equal(f.calls.filter(call => call.method === 'POST').length, 0);
});
test('CRM linking is explicit, phone-exact and never guesses a local country prefix', async () => {
  const f = fixture(), id = await f.open();
  const good = await f.Contact.create({ firstName: 'Sample', email: 'sample@example.test', phone: '+91 98000 00001' });
  const local = await f.Contact.create({ firstName: 'Local', email: 'local@example.test', phone: '9800000001' });
  await assert.rejects(f.service.link(id, { entityType: 'contact', entityId: local._id }, actor), { code: 'WHATSAPP_PHONE_MISMATCH' });
  assert.equal((await f.service.link(id, { entityType: 'contact', entityId: good._id }, actor)).conversation.contactId, good._id);
  assert.throws(() => normalizePhone('9800000001', true));
});
test('public event account and phone metadata are pinned to the configured account', async () => {
  const f = fixture(), other = f.inbound(); other.entry[0].id = '111111111111111'; await f.receive(other); assert.equal(f.Message.rows.length, 0);
  const phone = f.inbound(); phone.entry[0].changes[0].value.metadata.phone_number_id = '222222222222222'; await f.receive(phone); assert.equal(f.Message.rows.length, 0);
});
test('Graph HTTP calls use one fixed HTTPS origin, explicit version, bounded timeout and no redirects', async () => {
  const calls = [], request = createGraphRequest({ fetcher: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ data: [] }), { status: 200 }); } });
  await request({ path: privateEnv.WHATSAPP_BUSINESS_ACCOUNT_ID + '/phone_numbers', token: privateEnv.WHATSAPP_ACCESS_TOKEN, version: privateEnv.WHATSAPP_GRAPH_VERSION, query: { after: 'cursor/https://evil.test' } });
  assert.equal(new URL(calls[0].url).origin, 'https://graph.facebook.com'); assert.equal(calls[0].options.redirect, 'error'); assert.ok(calls[0].options.signal);
  await assert.rejects(request({ path: 'https://evil.test', token: 'private', version: 'v42.0' }), { code: 'WHATSAPP_CONFIGURATION' }); assert.equal(calls.length, 1);
  await assert.rejects(request({ method: 'DELETE', path: privateEnv.WHATSAPP_PHONE_NUMBER_ID, token: 'private', version: 'v42.0' }), { code: 'WHATSAPP_CONFIGURATION' }); assert.equal(calls.length, 1);
});
test('provider streaming preserves Kannada and other split UTF-8 characters exactly', async () => {
  const name = 'ಟೀಮ್ ಆಲ್ಫಾ · ಸಿನೆಮಾ', data = Buffer.from(JSON.stringify({ verified_name: name }));
  const request = createGraphRequest({ fetcher: async () => ({ ok: true, status: 200, body: (async function* () { for (let index = 0; index < data.length; index++) yield data.subarray(index, index + 1); })() }) });
  assert.equal((await request({ path: privateEnv.WHATSAPP_PHONE_NUMBER_ID, token: 'private', version: 'v42.0' })).verified_name, name);
});
