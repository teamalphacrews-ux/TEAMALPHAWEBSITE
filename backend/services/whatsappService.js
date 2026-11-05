const crypto = require('node:crypto');
const REQUIRED = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_GRAPH_VERSION'];
const ID = /^[a-f\d]{24}$/i, PROVIDER_ID = /^[A-Za-z0-9._=:+/-]{1,300}$/, WA_ID = /^[1-9]\d{6,14}$/;
const WINDOW = 24 * 60 * 60 * 1000;
const error = (message, status = 400, code = 'WHATSAPP_INPUT') => Object.assign(new Error(message), { status, code });
const iso = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const clean = (value, limit = 200) => typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, limit) : '';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const constantEqual = (first, second) => crypto.timingSafeEqual(Buffer.from(sha(first)), Buffer.from(sha(second)));
const plain = value => value?.toObject?.() || value;
function text(value, limit, required = true) {
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || (required && !value.trim())) throw error('Enter valid plain text.');
  return value.trim();
}
function normalizePhone(value, explicit = false) {
  if (typeof value !== 'string' || value.length > 35 || !/^[+\d ().-]+$/.test(value) || (explicit && !value.trim().startsWith('+'))) throw error('Enter an international phone number beginning with + and its country code.');
  const digits = value.replace(/\D/g, '');
  if (!WA_ID.test(digits) || (value.match(/\+/g) || []).length > 1 || (value.includes('+') && !value.trim().startsWith('+'))) throw error('Enter a valid international phone number.');
  return digits;
}
function configuration(env = process.env) {
  const validators = {
    WHATSAPP_ACCESS_TOKEN: v => typeof v === 'string' && v.length >= 20 && v.length <= 10000 && !/\s/.test(v),
    WHATSAPP_APP_SECRET: v => typeof v === 'string' && v.length >= 16 && v.length <= 512 && !/\s/.test(v),
    WHATSAPP_VERIFY_TOKEN: v => typeof v === 'string' && v.length >= 16 && v.length <= 512 && !/\s/.test(v),
    WHATSAPP_PHONE_NUMBER_ID: v => typeof v === 'string' && /^\d{5,30}$/.test(v),
    WHATSAPP_BUSINESS_ACCOUNT_ID: v => typeof v === 'string' && /^\d{5,30}$/.test(v),
    WHATSAPP_GRAPH_VERSION: v => typeof v === 'string' && /^v\d{1,3}\.\d{1,2}$/.test(v),
  };
  const missing = REQUIRED.filter(key => !validators[key](env[key]));
  let webhookUrl = '';
  try { const url = new URL(env.API_PUBLIC_URL); if (url.protocol === 'https:' && !url.username && !url.password) webhookUrl = url.origin + '/api/integrations/whatsapp/webhook'; } catch { /* A public callback is configured privately on the backend. */ }
  return { configured: !missing.length, missing, webhookUrl, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID, token: env.WHATSAPP_ACCESS_TOKEN, appSecret: env.WHATSAPP_APP_SECRET, verifyToken: env.WHATSAPP_VERIFY_TOKEN, version: env.WHATSAPP_GRAPH_VERSION,
    fingerprint: !missing.length ? sha(REQUIRED.map(key => env[key]).join('\0')) : '' };
}
function createGraphRequest({ fetcher = globalThis.fetch } = {}) {
  return async ({ method = 'GET', path, query = {}, body, token, version }) => {
    if (!/^v\d{1,3}\.\d{1,2}$/.test(version) || !/^\d{5,30}\/(phone_numbers|message_templates|messages)$/.test(path) && !/^\d{5,30}$/.test(path)) throw error('WhatsApp request is unavailable.', 503, 'WHATSAPP_CONFIGURATION');
    if (method !== 'GET' && !(method === 'POST' && /^\d{5,30}\/messages$/.test(path))) throw error('WhatsApp request is unavailable.', 503, 'WHATSAPP_CONFIGURATION');
    const url = new URL('https://graph.facebook.com/' + version + '/' + path);
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(url.href, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: controller.signal });
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) { const buffer = Buffer.from(chunk); bytes += buffer.length; if (bytes > 1024 * 1024) throw new Error('Provider response too large'); chunks.push(buffer); }
      const source = Buffer.concat(chunks, bytes).toString('utf8');
      let data;
      try { data = JSON.parse(source); } catch { throw Object.assign(new Error('Invalid provider response'), { httpStatus: response.status, ambiguous: method === 'POST' }); }
      if (!response.ok) throw Object.assign(new Error('Provider request failed'), { httpStatus: response.status, ambiguous: method === 'POST' && response.status >= 500 });
      return data;
    } catch (failure) {
      if (failure.httpStatus) throw failure;
      throw Object.assign(new Error('Provider request unavailable'), { ambiguous: method === 'POST' });
    } finally { clearTimeout(timer); }
  };
}
function templateProjection(item) {
  if (!item || item.status !== 'APPROVED' || !/^[a-z0-9_]{1,512}$/.test(item.name || '') || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(item.language || '') || item.parameter_format === 'NAMED') return null;
  if (!Array.isArray(item.components) || item.components.length !== 1 || item.components[0]?.type !== 'BODY') return null;
  const body = item.components[0].text;
  if (typeof body !== 'string' || !body.trim() || body.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)) return null;
  const indexes = [...body.matchAll(/{{\s*(\d+)\s*}}/g)].map(match => Number(match[1]));
  const stripped = body.replace(/{{\s*\d+\s*}}/g, '');
  const parameterCount = Math.max(0, ...indexes);
  if (stripped.includes('{{') || stripped.includes('}}') || parameterCount > 20 || new Set(indexes).size !== parameterCount || indexes.some(index => index < 1)) return null;
  return { name: item.name, language: item.language, body, category: clean(item.category, 40), parameterCount };
}
function cursor(value) {
  if (!value) return null;
  try { if (typeof value !== 'string' || value.length > 200 || !/^[\w-]+$/.test(value)) throw Error(); const [at, id, extra] = Buffer.from(value, 'base64url').toString().split('|'); if (extra || !ID.test(id) || iso(at) !== at) throw Error(); return { at: new Date(at), id }; } catch { throw error('The message page is invalid.'); }
}
const nextCursor = (date, id) => Buffer.from(iso(date) + '|' + id).toString('base64url');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function messageDTO(row, at = new Date()) {
  const age = new Date(at).getTime() - new Date(row.createdAt).getTime();
  const stale = row.status === 'sending' && (!Number.isFinite(age) || age >= 120000);
  return { id: String(row._id), direction: row.direction, kind: row.kind, text: row.text, status: stale ? 'unknown' : row.status, createdAt: iso(row.createdAt), ...(stale ? { error: 'Delivery could not be confirmed. Check WhatsApp before sending again.' } : row.error ? { error: row.error } : {}) };
}
function verifySignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 100 * 1024 || typeof signature !== 'string' || !/^sha256=[a-f\d]{64}$/i.test(signature) || !appSecret) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

function createWhatsAppService({ Connection = require('../models/WhatsAppConnection'), Conversation = require('../models/WhatsAppConversation'), Message = require('../models/WhatsAppMessage'), Receipt = require('../models/WhatsAppReceipt'), Contact = require('../models/StudioContact'), Lead = require('../models/Lead'), env = process.env, request = createGraphRequest(), now = () => new Date() } = {}) {
  const stamp = () => new Date(now());
  const config = () => { const value = configuration(env); if (!value.configured) throw error('WhatsApp setup is incomplete. Ask the studio owner to configure the backend connection.', 503, 'WHATSAPP_CONFIGURATION'); return value; };
  const provider = (c, path, options = {}) => request({ method: 'GET', path, token: c.token, version: c.version, ...options });
  async function status() {
    const c = configuration(env), base = { configured: c.configured, connected: false, state: 'setup_needed', displayPhoneNumber: '', verifiedName: '', verifiedAt: null, missing: c.missing, webhookUrl: c.webhookUrl };
    if (!c.configured) return base;
    const row = await Connection.findOne({ key: 'studio' }).select('+fingerprint');
    if (!row || row.fingerprint !== c.fingerprint) return { ...base, state: 'verification_needed' };
    const age = stamp().getTime() - new Date(row.verifiedAt || NaN).getTime();
    const fresh = Number.isFinite(age) && age >= 0 && age < WINDOW;
    const connected = row.state === 'connected' && row.coexistence === true && !!fresh;
    const state = connected ? 'connected' : ['coexistence_required', 'unavailable'].includes(row.state) ? row.state : 'verification_needed';
    return { ...base, state, connected, displayPhoneNumber: row.displayPhoneNumber || '', verifiedName: row.verifiedName || '', verifiedAt: iso(row.verifiedAt), ...(row.error ? { error: row.error } : {}) };
  }
  async function verifyRemote(c, actorId) {
    let phone, owns = false, after;
    try {
      for (let page = 0; page < 5; page++) {
        const result = await provider(c, c.businessAccountId + '/phone_numbers', { query: { fields: 'id', limit: 100, ...(after ? { after } : {}) } });
        if (!Array.isArray(result.data)) throw Error('Invalid business response');
        if (result.data.some(item => String(item.id) === c.phoneNumberId)) { owns = true; break; }
        after = result.paging?.cursors?.after;
        if (typeof after !== 'string' || !after || after.length > 2048 || !result.paging?.next) break;
      }
      if (!owns) throw error('The configured number does not belong to this WhatsApp Business account.', 409, 'WHATSAPP_ACCOUNT_MISMATCH');
      phone = await provider(c, c.phoneNumberId, { query: { fields: 'id,display_phone_number,verified_name,is_on_biz_app' } });
      if (String(phone.id) !== c.phoneNumberId) throw Error('Invalid phone response');
    } catch (failure) {
      const safe = failure.code?.startsWith('WHATSAPP_') ? failure : error('WhatsApp verification is unavailable. Check the backend credentials and Meta permissions.', 502, 'WHATSAPP_VERIFICATION');
      await Connection.findOneAndUpdate({ key: 'studio' }, { $set: { phoneNumberId: c.phoneNumberId, businessAccountId: c.businessAccountId, fingerprint: c.fingerprint, state: 'unavailable', coexistence: false, error: safe.message, verifiedAt: null } }, { upsert: true, new: true });
      throw safe;
    }
    const coexistence = phone.is_on_biz_app === true;
    await Connection.findOneAndUpdate({ key: 'studio' }, { $set: { phoneNumberId: c.phoneNumberId, businessAccountId: c.businessAccountId, fingerprint: c.fingerprint, state: coexistence ? 'connected' : 'coexistence_required', coexistence, displayPhoneNumber: clean(phone.display_phone_number, 40), verifiedName: clean(phone.verified_name), verifiedAt: stamp(), ...(actorId ? { verifiedBy: actorId } : {}), error: coexistence ? '' : 'Keep your existing WhatsApp Business app and number. Complete Meta’s supported coexistence setup before connecting Studio OS.' } }, { upsert: true, new: true });
    if (!coexistence) throw error('Your existing WhatsApp Business app must remain connected. Complete Meta’s supported coexistence setup, then verify again.', 409, 'WHATSAPP_COEXISTENCE_REQUIRED');
    return phone;
  }
  async function verifyConnection(actorId) { await verifyRemote(config(), actorId); return status(); }
  async function ensureVerified(c) {
    const row = await Connection.findOne({ key: 'studio' }).select('+fingerprint');
    if (!row || row.fingerprint !== c.fingerprint || row.state !== 'connected' || row.coexistence !== true) throw error('Verify the existing WhatsApp Business app connection before sending messages.', 409, 'WHATSAPP_VERIFICATION_REQUIRED');
  }
  async function loadConversation(id, c = config()) {
    if (!ID.test(String(id))) throw error('Conversation not found.', 404, 'WHATSAPP_NOT_FOUND');
    const row = await Conversation.findOne({ _id: id, phoneNumberId: c.phoneNumberId });
    if (!row) throw error('Conversation not found.', 404, 'WHATSAPP_NOT_FOUND');
    return row;
  }
  async function conversationDTO(row) {
    const unread = await Message.countDocuments({ conversation: row._id, phoneNumberId: row.phoneNumberId, direction: 'inbound', receivedAt: { $gt: row.lastReadAt || new Date(0) } });
    return { id: String(row._id), phone: '+' + row.waId, name: row.name || '+' + row.waId, contactId: row.contactId ? String(row.contactId) : null, leadId: row.leadId ? String(row.leadId) : null, lastMessage: row.lastMessage || '', lastMessageAt: iso(row.lastMessageAt), lastInboundAt: iso(row.lastInboundAt), windowExpiresAt: row.lastInboundAt ? iso(new Date(new Date(row.lastInboundAt).getTime() + WINDOW)) : null, unread, optIn: { confirmed: row.optInConfirmed === true, source: row.optInSource || '', at: iso(row.optInAt) } };
  }
  async function listConversations(query = {}) {
    const c = config(), filter = { phoneNumberId: c.phoneNumberId };
    if (query.q !== undefined) { const q = text(query.q, 100, false); if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { waId: { $regex: escapeRegex(q.replace(/^\+/, '')) } }]; }
    if (query.unread !== undefined && !['true', 'false'].includes(query.unread)) throw error('Choose a valid unread filter.');
    if (query.unread === 'true') filter.$expr = { $gt: [{ $ifNull: ['$lastInboundReceivedAt', new Date(0)] }, { $ifNull: ['$lastReadAt', new Date(0)] }] };
    const page = cursor(query.cursor);
    if (page) filter.$and = [{ $or: [{ lastMessageAt: { $lt: page.at } }, { lastMessageAt: page.at, _id: { $lt: page.id } }] }];
    const rows = await Conversation.find(filter).sort({ lastMessageAt: -1, _id: -1 }).limit(26);
    const chosen = rows.slice(0, 25), last = chosen.at(-1);
    return { conversations: await Promise.all(chosen.map(conversationDTO)), nextCursor: rows.length > 25 && last ? nextCursor(last.lastMessageAt || last.createdAt, last._id) : null };
  }
  async function conversation(id, query = {}) {
    const c = config(), row = await loadConversation(id, c), filter = { phoneNumberId: c.phoneNumberId, conversation: row._id, canonicalMessageId: { $exists: false } };
    const page = cursor(query.before);
    if (page) filter.$or = [{ createdAt: { $lt: page.at } }, { createdAt: page.at, _id: { $lt: page.id } }];
    const rows = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(51), chosen = rows.slice(0, 50), last = chosen.at(-1);
    return { conversation: await conversationDTO(row), messages: chosen.map(item => messageDTO(item, stamp())).reverse(), nextCursor: rows.length > 50 && last ? nextCursor(last.createdAt, last._id) : null };
  }
  async function upsertConversation(c, waId, name = '', at = stamp()) {
    const filter = { phoneNumberId: c.phoneNumberId, waId };
    try { return await Conversation.findOneAndUpdate(filter, { $setOnInsert: { ...filter, name, lastMessageAt: at } }, { upsert: true, new: true, setDefaultsOnInsert: true }); }
    catch (failure) { if (failure.code !== 11000) throw failure; return Conversation.findOne(filter); }
  }
  async function createConversation(body) {
    const c = config(), waId = normalizePhone(body?.phone, true), name = body?.name === undefined ? '' : text(body.name, 120, false);
    return { conversation: await conversationDTO(await upsertConversation(c, waId, name)) };
  }
  async function templates() {
    const c = config(); await ensureVerified(c);
    const result = [], keys = new Set(); let after, truncated = false;
    try {
      for (let page = 0; page < 3; page++) {
        const response = await provider(c, c.businessAccountId + '/message_templates', { query: { fields: 'name,language,status,category,components,parameter_format', limit: 100, ...(after ? { after } : {}) } });
        if (!Array.isArray(response.data)) throw Error('Invalid templates response');
        for (const source of response.data) { const item = templateProjection(source), key = item && item.name + ':' + item.language; if (item && !keys.has(key)) { keys.add(key); result.push(item); } }
        after = response.paging?.cursors?.after;
        if (typeof after !== 'string' || !after || after.length > 2048 || !response.paging?.next) break;
        if (page === 2) truncated = true;
      }
      return { templates: result, truncated };
    } catch { throw error('Approved WhatsApp templates could not be loaded. Try again shortly.', 502, 'WHATSAPP_TEMPLATES_UNAVAILABLE'); }
  }
  async function updatePreview(row, message) {
    await Conversation.updateOne({ _id: row._id, phoneNumberId: row.phoneNumberId, $or: [{ lastMessageAt: { $lte: message.createdAt } }, { lastMessageAt: { $exists: false } }] }, { $set: { lastMessage: clean(message.text, 160), lastMessageAt: message.createdAt } });
  }
  async function applyStatus(phoneNumberId, providerId, value, at) {
    const lower = {
      sent: ['sending', 'unknown', 'submitted'],
      delivered: ['sending', 'unknown', 'submitted', 'sent', 'failed'],
      read: ['sending', 'unknown', 'submitted', 'sent', 'delivered', 'failed'],
      failed: ['sending', 'unknown', 'submitted', 'sent'],
    };
    if (!lower[value]) return;
    // This condition is evaluated atomically. Concurrent lower-status receipts
    // cannot prevent a delivered/read receipt from advancing the same message.
    await Message.updateOne({ phoneNumberId, providerId, direction: 'outbound', status: { $in: lower[value] } }, { $set: { status: value, statusAt: at, error: value === 'failed' ? 'WhatsApp could not deliver this message.' : '' } });
  }
  async function applyStoredStatuses(phoneNumberId, providerId) {
    for (const receipt of await Receipt.find({ phoneNumberId, providerId, eventType: 'status' }).sort({ eventAt: 1, _id: 1 }).limit(100)) await applyStatus(phoneNumberId, providerId, receipt.status, receipt.eventAt);
  }
  async function send(id, body, actorId) {
    const c = config(), row = await loadConversation(id, c);
    if (!body || !/^[a-f\d]{32}$/i.test(body.requestId || '') || !['text', 'template'].includes(body.kind)) throw error('Choose a valid message and retry key.');
    const requestId = body.requestId.toLowerCase();
    const normalized = body.kind === 'text' ? { kind: 'text', text: text(body.text, 4096) } : { kind: 'template', template: { name: text(body.template?.name, 512), language: text(body.template?.language, 20), parameters: body.template?.parameters } };
    if (normalized.kind === 'template' && (!Array.isArray(normalized.template.parameters) || normalized.template.parameters.length > 20 || normalized.template.parameters.some(value => typeof value !== 'string' || !value.trim() || value.length > 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)))) throw error('Enter valid template parameters.');
    const payloadHash = sha(JSON.stringify({ conversation: String(row._id), ...normalized }));
    let existing = await Message.findOne({ phoneNumberId: c.phoneNumberId, requestId }).select('+payloadHash');
    const prior = async record => {
      if (record.payloadHash !== payloadHash || String(record.conversation) !== String(row._id)) throw error('This retry key belongs to a different message. Create a new message instead.', 409, 'WHATSAPP_REQUEST_CONFLICT');
      if (record.canonicalMessageId) record = await Message.findOne({ _id: record.canonicalMessageId, phoneNumberId: c.phoneNumberId }) || record;
      if (record.status === 'sending' && new Date(record.createdAt).getTime() < stamp().getTime() - 120000) { await Message.updateOne({ _id: record._id, status: 'sending' }, { $set: { status: 'unknown', error: 'Delivery could not be confirmed. Check WhatsApp before sending again.' } }); record = { ...plain(record), status: 'unknown', error: 'Delivery could not be confirmed. Check WhatsApp before sending again.' }; }
      return { message: messageDTO(record, stamp()), conversation: await conversationDTO(await loadConversation(id, c)) };
    };
    if (existing) return prior(existing);
    await ensureVerified(c);
    const validateWindow = current => {
      const at = stamp(), withinWindow = current.lastInboundAt && at.getTime() - new Date(current.lastInboundAt).getTime() < WINDOW && new Date(current.lastInboundAt) <= at;
      if (body.kind === 'text' && !withinWindow) throw error('The 24-hour reply window is closed. Use an approved template after recording the client’s permission.', 409, 'WHATSAPP_WINDOW_CLOSED');
      if (!withinWindow && (!current.optInConfirmed || !current.optInAt || !current.optInSource)) throw error('Record the client’s permission before starting a WhatsApp conversation.', 409, 'WHATSAPP_OPT_IN_REQUIRED');
    };
    validateWindow(row);
    let visibleText = normalized.text, payload;
    if (body.kind === 'template') {
      const selected = (await templates()).templates.find(item => item.name === normalized.template.name && item.language === normalized.template.language);
      if (!selected || selected.parameterCount !== normalized.template.parameters.length) throw error('Choose a currently approved, supported text template and fill every parameter.', 409, 'WHATSAPP_TEMPLATE_UNAVAILABLE');
      visibleText = selected.body.replace(/{{\s*(\d+)\s*}}/g, (_match, index) => normalized.template.parameters[Number(index) - 1]);
      if (visibleText.length > 4096) throw error('This template message is too long. Shorten its parameters.');
      payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: row.waId, type: 'template', template: { name: selected.name, language: { code: selected.language }, ...(selected.parameterCount ? { components: [{ type: 'body', parameters: normalized.template.parameters.map(value => ({ type: 'text', text: value })) }] } : {}) } };
    } else payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: row.waId, type: 'text', text: { preview_url: false, body: normalized.text } };
    await verifyRemote(c, actorId); // A read-only coexistence check precedes every new send.
    validateWindow(await loadConversation(id, c));
    const at = stamp(); let attempt;
    try { attempt = await Message.create({ phoneNumberId: c.phoneNumberId, conversation: row._id, waId: row.waId, requestId, payloadHash, direction: 'outbound', kind: body.kind, text: visibleText, status: 'sending', actor: actorId, createdAt: at }); }
    catch (failure) { if (failure.code !== 11000) throw failure; existing = await Message.findOne({ phoneNumberId: c.phoneNumberId, requestId }).select('+payloadHash'); if (!existing) throw failure; return prior(existing); }
    const gate = await Conversation.findOneAndUpdate({ _id: row._id, phoneNumberId: c.phoneNumberId, $or: [{ lastSendAttemptAt: { $lte: new Date(at.getTime() - 1000) } }, { lastSendAttemptAt: { $exists: false } }] }, { $set: { lastSendAttemptAt: at } }, { new: true });
    if (!gate) { await Message.updateOne({ _id: attempt._id }, { $set: { status: 'failed', error: 'Wait a moment before sending another message.' } }); throw error('Wait a moment before sending another message.', 429, 'WHATSAPP_RATE_LIMIT'); }
    await updatePreview(row, attempt);
    try {
      validateWindow(await loadConversation(id, c));
      const response = await provider(c, c.phoneNumberId + '/messages', { method: 'POST', body: payload });
      const providerId = response.messages?.[0]?.id;
      if (typeof providerId !== 'string' || !PROVIDER_ID.test(providerId)) throw Object.assign(new Error('Missing provider receipt'), { ambiguous: true });
      try { await Message.updateOne({ _id: attempt._id, status: 'sending' }, { $set: { providerId, status: 'submitted', statusAt: stamp() } }); }
      catch (failure) {
        if (failure.code !== 11000) throw failure;
        const echoed = await Message.findOne({ phoneNumberId: c.phoneNumberId, providerId, direction: 'outbound' });
        if (!echoed || echoed.waId !== row.waId) throw failure;
        await Message.updateOne({ _id: attempt._id }, { $set: { canonicalMessageId: echoed._id, status: 'submitted' } });
      }
      await applyStoredStatuses(c.phoneNumberId, providerId);
    } catch (failure) {
      const policyFailure = ['WHATSAPP_WINDOW_CLOSED', 'WHATSAPP_OPT_IN_REQUIRED'].includes(failure.code);
      const knownRejection = policyFailure || failure.httpStatus >= 400 && failure.httpStatus < 500 && failure.httpStatus !== 408 && failure.ambiguous !== true;
      await Message.updateOne({ _id: attempt._id, status: 'sending' }, { $set: { status: knownRejection ? 'failed' : 'unknown', error: policyFailure ? failure.message : knownRejection ? 'WhatsApp declined this message. Check the recipient, template and connection before sending again.' : 'Delivery could not be confirmed. Check WhatsApp before sending again.' } });
    }
    return prior(await Message.findOne({ _id: attempt._id }).select('+payloadHash'));
  }
  async function link(id, body) {
    const c = config(), row = await loadConversation(id, c);
    if (!['contact', 'enquiry'].includes(body?.entityType) || !ID.test(body?.entityId || '')) throw error('Choose an existing contact or enquiry.');
    const entity = await (body.entityType === 'contact' ? Contact : Lead).findById(body.entityId);
    if (!entity || entity.archived === true || entity.status === 'Archived') throw error('Contact or enquiry not found.', 404, 'WHATSAPP_NOT_FOUND');
    let phone; try { phone = normalizePhone(entity.phone); } catch { throw error('This record needs the same international phone number before it can be linked.', 409, 'WHATSAPP_PHONE_MISMATCH'); }
    if (phone !== row.waId) throw error('The selected record has a different phone number. Update the correct CRM record first.', 409, 'WHATSAPP_PHONE_MISMATCH');
    const update = body.entityType === 'contact' ? { contactId: entity._id, leadId: null } : { leadId: entity._id, contactId: entity.contactId || null };
    const updated = await Conversation.findOneAndUpdate({ _id: row._id, phoneNumberId: c.phoneNumberId }, { $set: update }, { new: true });
    return { conversation: await conversationDTO(updated) };
  }
  async function consent(id, body, actorId) {
    const c = config(), row = await loadConversation(id, c);
    if (typeof body?.confirmed !== 'boolean') throw error('Choose whether the client has given permission.');
    const source = body.confirmed ? text(body.source, 300) : '';
    const updated = await Conversation.findOneAndUpdate({ _id: row._id, phoneNumberId: c.phoneNumberId }, { $set: { optInConfirmed: body.confirmed, optInSource: source, optInAt: body.confirmed ? stamp() : null, optInBy: actorId } }, { new: true });
    return { conversation: await conversationDTO(updated) };
  }
  async function markRead(id) {
    const c = config(), row = await loadConversation(id, c), updated = await Conversation.findOneAndUpdate({ _id: row._id, phoneNumberId: c.phoneNumberId }, { $max: { lastReadAt: stamp() } }, { new: true });
    return { conversation: await conversationDTO(updated) };
  }
  function challenge(query = {}) {
    const token = env.WHATSAPP_VERIFY_TOKEN;
    if (typeof token !== 'string' || token.length < 16) throw error('WhatsApp webhook verification is not configured.', 503, 'WHATSAPP_CONFIGURATION');
    if (query['hub.mode'] !== 'subscribe' || typeof query['hub.verify_token'] !== 'string' || query['hub.verify_token'].length > 512 || typeof query['hub.challenge'] !== 'string' || !/^\d{1,200}$/.test(query['hub.challenge']) || !constantEqual(query['hub.verify_token'], token)) throw error('Webhook verification failed.', 403, 'WHATSAPP_WEBHOOK_VERIFICATION');
    return query['hub.challenge'];
  }
  function eventsFromPayload(body, c) {
    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry) || body.entry.length > 20) throw error('Invalid WhatsApp webhook payload.');
    const events = [], nowAt = stamp();
    const eventDate = value => { if (!/^\d{1,13}$/.test(String(value || ''))) throw error('Invalid WhatsApp event timestamp.'); const date = new Date(Number(value) * 1000); if (!iso(date) || date.getTime() > nowAt.getTime() + 300000) throw error('Invalid WhatsApp event timestamp.'); return date > nowAt ? nowAt : date; };
    for (const entry of body.entry) {
      if (String(entry?.id) !== c.businessAccountId) continue;
      if (!Array.isArray(entry.changes) || entry.changes.length > 100) throw error('Invalid WhatsApp webhook changes.');
      for (const change of entry.changes) {
        const value = change?.value;
        if (!['messages', 'smb_message_echoes'].includes(change.field) || String(value?.metadata?.phone_number_id) !== c.phoneNumberId) continue;
        const names = new Map((Array.isArray(value.contacts) ? value.contacts.slice(0, 100) : []).map(item => [item.wa_id, clean(item.profile?.name, 120)]));
        const echo = change.field === 'smb_message_echoes', sources = echo ? value.message_echoes || [] : value.messages || [];
        if (!Array.isArray(sources) || sources.length > 100 || value.statuses && (!Array.isArray(value.statuses) || value.statuses.length > 100)) throw error('Invalid WhatsApp webhook messages.');
        for (const source of sources) {
          const waId = echo ? source?.to : source?.from;
          if (!WA_ID.test(waId || '') || !PROVIDER_ID.test(source?.id || '')) throw error('Invalid WhatsApp message identity.');
          const isText = source.type === 'text', messageText = isText ? text(source.text?.body, 4096) : '[' + ({ image: 'Image', video: 'Video', audio: 'Audio', document: 'Document', sticker: 'Sticker', location: 'Location', contacts: 'Contact', interactive: 'Interactive', reaction: 'Reaction', button: 'Button', system: 'System' }[source.type] || 'Unsupported') + ' message — open WhatsApp Business to view]';
          events.push({ phoneNumberId: c.phoneNumberId, providerId: source.id, eventType: echo ? 'echo' : 'inbound', waId, name: names.get(waId) || '', kind: isText ? 'text' : 'unsupported', text: messageText, eventAt: eventDate(source.timestamp), opensWindow: !echo && ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contacts', 'interactive', 'reaction', 'button', 'order'].includes(source.type) });
        }
        for (const source of value.statuses || []) {
          if (!['sent', 'delivered', 'read', 'failed'].includes(source.status)) continue;
          if (!PROVIDER_ID.test(source.id || '')) throw error('Invalid WhatsApp delivery identity.');
          events.push({ phoneNumberId: c.phoneNumberId, providerId: source.id, eventType: 'status', status: source.status, eventAt: eventDate(source.timestamp) });
        }
        if (events.length > 200) throw error('Too many WhatsApp events.');
      }
    }
    return events;
  }
  async function processReceipt(receipt, c) {
    if (receipt.done) return;
    const current = stamp(), locked = await Receipt.findOneAndUpdate({ _id: receipt._id, done: false, $or: [{ processingUntil: { $lte: current } }, { processingUntil: { $exists: false } }] }, { $set: { processingUntil: new Date(current.getTime() + 120000) } }, { new: true });
    if (!locked) { const latest = await Receipt.findById(receipt._id); if (latest?.done) return; throw error('WhatsApp event processing is in progress. Retry the webhook.', 503, 'WHATSAPP_WEBHOOK_RETRY'); }
    try {
      if (locked.eventType === 'status') await applyStatus(c.phoneNumberId, locked.providerId, locked.status, locked.eventAt);
      else {
        const row = await upsertConversation(c, locked.waId, locked.name, locked.eventAt);
        let message;
        try { message = await Message.create({ phoneNumberId: c.phoneNumberId, conversation: row._id, waId: locked.waId, providerId: locked.providerId, direction: locked.eventType === 'inbound' ? 'inbound' : 'outbound', kind: locked.kind, text: locked.text, status: locked.eventType === 'inbound' ? 'received' : 'sent', receivedAt: stamp(), createdAt: locked.eventAt }); }
        catch (failure) { if (failure.code !== 11000) throw failure; message = await Message.findOne({ phoneNumberId: c.phoneNumberId, providerId: locked.providerId }); if (!message) throw failure; }
        await updatePreview(row, message);
        if (locked.eventType === 'inbound') await Conversation.updateOne({ _id: row._id, phoneNumberId: c.phoneNumberId }, { $max: { lastInboundReceivedAt: message.receivedAt, ...(locked.opensWindow ? { lastInboundAt: locked.eventAt } : {}) } });
        if (locked.eventType === 'echo') await applyStoredStatuses(c.phoneNumberId, locked.providerId);
      }
      await Receipt.updateOne({ _id: receipt._id }, { $set: { done: true, processingUntil: stamp() } });
    } catch (failure) { await Receipt.updateOne({ _id: receipt._id, done: false }, { $set: { processingUntil: stamp() } }).catch(() => {}); throw failure; }
  }
  async function receive(rawBody, signature) {
    const c = config();
    if (!verifySignature(rawBody, signature, c.appSecret)) throw error('WhatsApp webhook signature is invalid.', 401, 'WHATSAPP_WEBHOOK_SIGNATURE');
    let payload; try { payload = JSON.parse(rawBody.toString('utf8')); } catch { throw error('Invalid WhatsApp webhook JSON.'); }
    const events = eventsFromPayload(payload, c);
    for (const event of events) {
      const key = sha(JSON.stringify([event.phoneNumberId, event.providerId, event.eventType, event.status || '', event.eventType === 'status' ? iso(event.eventAt) : '']));
      let receipt;
      try { receipt = await Receipt.findOneAndUpdate({ _id: key }, { $setOnInsert: { ...event, done: false } }, { upsert: true, new: true, setDefaultsOnInsert: true }); }
      catch (failure) { if (failure.code !== 11000) throw failure; receipt = await Receipt.findById(key); if (!receipt) throw failure; }
      await processReceipt(receipt, c);
    }
    return { received: true, processed: events.length };
  }
  return { status, verifyConnection, listConversations, conversation, createConversation, send, templates, link, consent, markRead, challenge, receive };
}
module.exports = { ...createWhatsAppService(), createWhatsAppService, createGraphRequest, configuration, normalizePhone, templateProjection, verifySignature };
