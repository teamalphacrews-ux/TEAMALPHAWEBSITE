const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const security = require('../services/studioSecurity');

const MAX_WEBHOOK_BYTES = 100 * 1024;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const inputError = message => Object.assign(new Error(message), { status: 400, code: 'WHATSAPP_INPUT' });
function fields(value, allowed, required = []) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !own(value, key))) throw inputError('The WhatsApp request contains unsupported or missing fields.');
  return value;
}
function string(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || [...value].some(char => char.charCodeAt(0) === 0)) throw inputError('Enter a valid WhatsApp message or value.');
  return value;
}
function recordId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw inputError('Choose a valid WhatsApp conversation.');
  return value;
}
function query(value, allowed) {
  const result = fields(value || {}, allowed);
  for (const [key, entry] of Object.entries(result)) {
    string(entry, key === 'q' ? 100 : 2048, false);
    if ((key === 'before' || key === 'cursor') && !/^[A-Za-z0-9_-]{1,2048}$/.test(entry)) throw inputError('Choose a valid conversation page.');
    if (key === 'unread' && !['true', 'false'].includes(entry)) throw inputError('Choose a valid unread filter.');
  }
  return result;
}
function message(value) {
  const result = fields(value, ['requestId', 'kind', 'text', 'template'], ['requestId', 'kind']);
  if (typeof result.requestId !== 'string' || !/^[a-f\d]{32}$/i.test(result.requestId)) throw inputError('This message needs a valid request identity.');
  if (result.kind === 'text') {
    if (own(result, 'template')) throw inputError('Choose one message type.');
    string(result.text, 4096);
  } else if (result.kind === 'template') {
    if (own(result, 'text')) throw inputError('Choose one message type.');
    const template = fields(result.template, ['name', 'language', 'parameters'], ['name', 'language', 'parameters']);
    string(template.name, 512); string(template.language, 32);
    if (!Array.isArray(template.parameters) || template.parameters.length > 20) throw inputError('Enter the approved template values.');
    template.parameters.forEach(value => string(value, 1024));
  } else throw inputError('Choose a supported WhatsApp message type.');
  return result;
}
const safeStatuses = new Set([400, 401, 403, 404, 409, 413, 415, 422, 429, 502, 503, 504]);
function sendError(res, error) {
  const safe = /^WHATSAPP_[A-Z0-9_]+$/.test(error?.code || '') && safeStatuses.has(error.status) && typeof error.message === 'string' && error.message.length <= 600;
  return res.status(safe ? error.status : 503).json({ error: safe ? error.message : 'WhatsApp is temporarily unavailable. Please try again.', code: safe ? error.code : 'WHATSAPP_UNAVAILABLE' });
}

function createWhatsAppRouter({ service, authenticate = auth, authorize = requireAdmin, isOwner = id => security.isOwner(id), assertOwner = id => security.assertOwner(id) } = {}) {
  const router = express.Router(), api = () => service || require('../services/whatsappService');
  const wrap = handler => async (req, res) => { try { await handler(req, res); } catch (error) { sendError(res, error); } };
  const empty = req => { fields(req.body === undefined ? {} : req.body, []); query(req.query, []); };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });

  router.get('/webhook', wrap(async (req, res) => {
    const values = fields(req.query || {}, ['hub.mode', 'hub.verify_token', 'hub.challenge'], ['hub.mode', 'hub.verify_token', 'hub.challenge']);
    string(values['hub.mode'], 30); string(values['hub.verify_token'], 512); string(values['hub.challenge'], 200);
    if (!/^\d{1,200}$/.test(values['hub.challenge'])) throw inputError('The webhook challenge is invalid.');
    const challenge = await api().challenge(values);
    res.type('text/plain').status(200).send(challenge);
  }));
  router.post('/webhook', wrap(async (req, res) => {
    query(req.query, []);
    const signature = req.header('x-hub-signature-256');
    if (typeof signature !== 'string' || !/^sha256=[a-f\d]{64}$/i.test(signature)) throw Object.assign(new Error('Webhook signature is invalid.'), { status: 401, code: 'WHATSAPP_SIGNATURE' });
    const contentType = req.header('content-type');
    if (typeof contentType !== 'string' || !/^application\/json(?:\s*;|$)/i.test(contentType)) throw Object.assign(new Error('Use the WhatsApp JSON webhook format.'), { status: 415, code: 'WHATSAPP_CONTENT_TYPE' });
    if (!Buffer.isBuffer(req.rawBody) || !req.rawBody.length) throw inputError('The exact webhook request body is required.');
    if (req.rawBody.length > MAX_WEBHOOK_BYTES) throw Object.assign(new Error('The WhatsApp webhook is too large.'), { status: 413, code: 'WHATSAPP_PAYLOAD_SIZE' });
    await api().receive(req.rawBody, signature);
    res.status(200).json({ received: true });
  }));

  router.use(authenticate, authorize);
  router.get('/status', wrap(async (req, res) => { query(req.query, []); const status = await api().status(); res.json({ ...status, owner: await isOwner(req.user.id) }); }));
  router.post('/verify', wrap(async (req, res) => {
    empty(req);
    try { await assertOwner(req.user.id); }
    catch (error) { throw Object.assign(new Error(error?.status === 403 ? 'Only the studio owner can verify the WhatsApp connection.' : 'Studio owner verification is temporarily unavailable.'), { status: error?.status === 403 ? 403 : 503, code: 'WHATSAPP_OWNER' }); }
    res.json({ ...await api().verifyConnection(req.user.id), owner: true });
  }));
  router.get('/conversations', wrap(async (req, res) => res.json(await api().listConversations(query(req.query, ['q', 'unread', 'cursor'])))));
  router.post('/conversations', wrap(async (req, res) => {
    query(req.query, []);
    const values = fields(req.body, ['phone', 'name'], ['phone']); string(values.phone, 40); if (own(values, 'name')) string(values.name, 160, false);
    res.status(201).json(await api().createConversation(values, req.user.id));
  }));
  router.get('/conversations/:id', wrap(async (req, res) => res.json(await api().conversation(recordId(req.params.id), query(req.query, ['before'])))));
  router.post('/conversations/:id/messages', wrap(async (req, res) => { query(req.query, []); res.json(await api().send(recordId(req.params.id), message(req.body), req.user.id)); }));
  router.get('/templates', wrap(async (req, res) => { query(req.query, []); res.json(await api().templates()); }));
  router.put('/conversations/:id/link', wrap(async (req, res) => {
    query(req.query, []); const id = recordId(req.params.id), values = fields(req.body, ['entityType', 'entityId'], ['entityType', 'entityId']);
    if (!['contact', 'enquiry'].includes(values.entityType)) throw inputError('Choose a contact or enquiry to link.'); recordId(values.entityId);
    res.json(await api().link(id, values, req.user.id));
  }));
  router.put('/conversations/:id/consent', wrap(async (req, res) => {
    query(req.query, []); const id = recordId(req.params.id), values = fields(req.body, ['confirmed', 'source'], ['confirmed']);
    if (typeof values.confirmed !== 'boolean') throw inputError('Choose whether the client has agreed to WhatsApp contact.');
    if (values.confirmed || own(values, 'source')) string(values.source, 500, values.confirmed);
    res.json(await api().consent(id, values, req.user.id));
  }));
  router.post('/conversations/:id/read', wrap(async (req, res) => { empty(req); res.json(await api().markRead(recordId(req.params.id), req.user.id)); }));
  return router;
}

module.exports = createWhatsAppRouter();
module.exports.createWhatsAppRouter = createWhatsAppRouter;
module.exports.MAX_WEBHOOK_BYTES = MAX_WEBHOOK_BYTES;
