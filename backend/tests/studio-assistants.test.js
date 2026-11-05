const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudioAssistantService, draftInput, gatewayUrl, MAX_RESPONSE_BYTES } = require('../services/studioAssistantService');
const env = { NODE_ENV: 'test', OPENAI_API_KEY: 'private-openai-key', OPENAI_MODEL: 'configured-openai-model', ANTHROPIC_API_KEY: 'private-claude-key', ANTHROPIC_MODEL: 'configured-claude-model', OPENCLAW_GATEWAY_URL: 'https://assistant.internal', OPENCLAW_GATEWAY_TOKEN: 'private-gateway-token', OPENCLAW_PRIVATE_GATEWAY_CONFIRMED: 'true' };
const input = { task: 'reply', context: 'A client asks when their album selections are needed. No deadline has been agreed.', tone: 'professional', consent: true };
const id = '507f1f77bcf86cd799439011';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const openai = text => ({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
function fixture(extra = {}) {
  const calls = [];
  const service = createStudioAssistantService({ env: { ...env }, fetchImpl: async (url, options) => { calls.push({ url, options }); return json(url.includes('anthropic') ? { content: [{ type: 'text', text: 'A reviewable Claude draft.' }] } : url.includes('internal') ? { object: 'list', data: [{ id: 'private-agent' }] } : openai('A reviewable OpenAI draft.')); }, ...extra });
  return { service, calls };
}
test('status is network-free, distinguishes setup from verification and never returns credentials', () => {
  const { service, calls } = fixture(); const status = service.status();
  assert.deepEqual(status.providers.map(row => row.id), ['openai', 'claude', 'openclaw']);
  assert.ok(status.providers.every(row => row.configured));
  assert.equal(status.providers.find(row => row.id === 'openclaw').draftSupported, false);
  assert.equal(calls.length, 0); assert.doesNotMatch(JSON.stringify(status), /private-openai-key|private-claude-key|private-gateway-token|assistant\.internal/);
  const missing = createStudioAssistantService({ env: { OPENAI_API_KEY: 'private-openai-key' } }).status();
  assert.ok(missing.providers.every(row => !row.configured));
});
test('context, task, tone, explicit sharing consent and unsupported fields are validated', () => {
  assert.equal(draftInput(input).context, input.context);
  for (const changes of [{ consent: false }, { consent: undefined }, { context: '' }, { context: 'x'.repeat(12001) }, { context: 'bad\0text' }, { tone: 'invent-prices' }, { task: 'send-email' }, { apiKey: 'no' }, { gatewayUrl: 'https://evil.example' }]) assert.throws(() => draftInput({ ...input, ...changes }));
});
test('OpenAI drafts use fixed Responses endpoint, server model, disabled storage and user-provided context only', async () => {
  const { service, calls } = fixture(), result = await service.draft('openai', input, id), { url, options } = calls[0], body = JSON.parse(options.body);
  assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.redirect, 'error');
  assert.equal(body.model, env.OPENAI_MODEL); assert.equal(body.store, false); assert.equal(body.tools, undefined);
  assert.match(body.input, /A client asks/); assert.match(body.instructions, /Do not invent prices/);
  assert.equal(options.headers.Authorization, 'Bearer private-openai-key'); assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(result, { draft: 'A reviewable OpenAI draft.', provider: 'openai', model: env.OPENAI_MODEL });
});
test('Claude drafts use fixed Messages endpoint and a separate server credential', async () => {
  const { service, calls } = fixture(); const result = await service.draft('claude', { ...input, task: 'quotation', tone: 'warm' }, id), { url, options } = calls[0], body = JSON.parse(options.body);
  assert.equal(url, 'https://api.anthropic.com/v1/messages'); assert.equal(options.headers['x-api-key'], env.ANTHROPIC_API_KEY); assert.equal(options.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.model, env.ANTHROPIC_MODEL); assert.equal(body.tools, undefined); assert.match(body.messages[0].content, /not an issued quote/);
  assert.equal(result.provider, 'claude');
});
test('tests only send fixed non-client context and do not return generated content', async () => {
  const { service, calls } = fixture(); const result = await service.test('openai', id);
  assert.equal(Object.keys(result).join(), 'message'); assert.match(result.message, /responding/); assert.match(JSON.parse(calls[0].options.body).input, /Connection test only/);
});
test('OpenClaw only checks model-list access and never performs inference or agent actions', async () => {
  const { service, calls } = fixture(); assert.match((await service.test('openclaw', id)).message, /drafting and agent actions remain disabled/);
  assert.equal(calls[0].url, 'https://assistant.internal/v1/models'); assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.body, undefined);
  await assert.rejects(service.draft('openclaw', input, id), { code: 'ASSISTANT_CAPABILITY', status: 409 }); assert.equal(calls.length, 1);
});
test('OpenClaw requires private-gateway acknowledgement and rejects unsafe URL structure', async () => {
  assert.equal(gatewayUrl('http://127.0.0.1:18789'), 'http://127.0.0.1:18789');
  for (const value of ['http://public.example', 'https://name:secret@assistant.internal', 'https://assistant.internal/path', 'https://assistant.internal?token=secret', 'https://assistant.internal#secret', 'file:///etc/passwd', '']) assert.equal(gatewayUrl(value), null);
  const { service, calls } = fixture({ env: { ...env, OPENCLAW_PRIVATE_GATEWAY_CONFIRMED: 'false' } });
  await assert.rejects(service.test('openclaw', id), { code: 'ASSISTANT_CONFIGURATION' }); assert.equal(calls.length, 0);
});
test('missing setup and disposable preview never dispatch network requests', async () => {
  for (const settings of [{ env: {} }, { env: { ...env, STUDIO_LOCAL_PREVIEW: 'true' } }]) {
    const { service, calls } = fixture(settings); await assert.rejects(service.draft('openai', input, id)); assert.equal(calls.length, 0);
  }
});
test('provider errors cannot expose response bodies, credentials or raw exception messages', async () => {
  for (const status of [400, 401, 403, 429, 500]) {
    const { service } = fixture({ fetchImpl: async () => json({ error: { message: 'private-openai-key private-client-data' } }, status) });
    await assert.rejects(service.draft('openai', input, id), error => { assert.doesNotMatch(error.message, /private-openai-key|private-client-data/); return true; });
  }
  const { service } = fixture({ fetchImpl: async () => { throw new Error('Bearer private-openai-key'); } });
  await assert.rejects(service.test('openai', id), { code: 'ASSISTANT_UNAVAILABLE', message: 'The assistant is temporarily unavailable. Please try again.' });
});
test('response bounds, malformed output, incomplete output and unsupported gateway lists fail safely', async () => {
  for (const result of [() => new Response('x'.repeat(MAX_RESPONSE_BYTES + 1)), () => new Response('not json'), () => json({ ...openai('Partial'), status: 'incomplete' }), () => json(openai('x'.repeat(16001))), () => json({ output: [] })]) {
    const { service } = fixture({ fetchImpl: async () => result() }); await assert.rejects(service.test('openai', id), { code: 'ASSISTANT_RESPONSE' });
  }
  const { service } = fixture({ fetchImpl: async () => json({ object: 'list', data: [] }) }); await assert.rejects(service.test('openclaw', id), { code: 'ASSISTANT_RESPONSE' });
});
test('one owner cannot duplicate in-flight requests; request slots release after failure', async () => {
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const { service } = fixture({ fetchImpl: async () => { await pending; return json(openai('Done.')); } });
  const first = service.draft('openai', input, id);
  await assert.rejects(service.draft('claude', input, id), { code: 'ASSISTANT_BUSY' }); finish(); await first;
  assert.match((await service.test('openai', id)).message, /responding/);
});
test('provider requests have bounded owner rate and global concurrency', async () => {
  let clock = 1; const { service, calls } = fixture({ now: () => clock });
  for (let i = 0; i < 6; i++) await service.test('openai', id);
  await assert.rejects(service.test('openai', id), { code: 'ASSISTANT_RATE_LIMIT' }); assert.equal(calls.length, 6);
  clock = 60002; await service.test('openai', id); assert.equal(calls.length, 7);
  let finish; const pending = new Promise(resolve => { finish = resolve; }); const concurrent = fixture({ fetchImpl: async () => { await pending; return json(openai('Done.')); } }).service;
  const active = ['a', 'b', 'c'].map(actor => concurrent.test('openai', actor));
  await assert.rejects(concurrent.test('openai', 'd'), { code: 'ASSISTANT_RATE_LIMIT' }); finish(); await Promise.all(active);
});
test('network timeout covers provider requests and releases the in-flight slot', async () => {
  const { service } = fixture({ timeoutMs: 5, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  await assert.rejects(service.test('openai', id), { code: 'ASSISTANT_TIMEOUT', status: 504 });
  await assert.rejects(service.test('openai', id), { code: 'ASSISTANT_TIMEOUT' });
});

test('router requires authentication, fresh owner authorization and personal workspace context', async t => {
  const express = require('express'), { createStudioAssistantRouter } = require('../routes/studioAssistantRoutes'); let owner = true, workspace = null, paused = false; const calls = [];
  const app = express(); app.use(express.json());
  app.use(createStudioAssistantRouter({
    authenticate: (req, res, next) => { if (!req.header('x-actor')) return res.status(401).json({ error: 'Sign in' }); req.user = { id, role: req.header('x-role') || 'admin' }; next(); },
    isOwner: async () => owner, workspace: () => workspace,
    service: { status: () => ({ providers: [] }), test: async (...args) => { calls.push(args); return { message: 'Verified' }; }, draft: async (...args) => { calls.push(args); return { draft: 'Review me' }; } },
    archiveGate: { withShared: async (run, options) => { assert.deepEqual(options, { integrations: true, rejectPaused: true }); if (paused) throw Object.assign(new Error('private db detail'), { code: 'WORKSPACE_INTEGRATIONS_PAUSED' }); return run(); } },
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (path, options = {}) => fetch(base + path, { ...options, headers: { 'x-actor': id, 'content-type': 'application/json', ...options.headers } });
  assert.equal((await fetch(base + '/status')).status, 401);
  assert.equal((await request('/status', { headers: { 'x-role': 'client' } })).status, 403);
  owner = false; assert.equal((await request('/status')).status, 403); owner = true;
  workspace = { _id: id }; assert.equal((await request('/status')).status, 409); workspace = null;
  const status = await request('/status'); assert.equal(status.status, 200); assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/openai/test', { method: 'POST', body: JSON.stringify({ apiKey: 'browser-secret' }) })).status, 400);
  assert.equal((await request('/status?userId=other')).status, 400);
  paused = true; const denied = await request('/openai/draft', { method: 'POST', body: JSON.stringify(input) }); assert.equal(denied.status, 409); assert.equal((await denied.json()).code, 'ASSISTANT_PAUSED'); assert.equal(calls.length, 0);
  paused = false; assert.equal((await request('/openai/draft', { method: 'POST', body: JSON.stringify(input) })).status, 200); assert.equal(calls[0][2], id);
});
