const crypto = require('node:crypto');

const REQUIRED = ['WHATSAPP_PROVIDER', 'WABB_API_KEY', 'WABB_WORKSPACE_ID', 'WABB_PHONE_NUMBER'];
const DAY = 24 * 60 * 60 * 1000;
const UNKNOWN = 'Delivery could not be confirmed. Check Wabb before sending again.';
const REJECTED = 'Wabb rejected this message. Check the recipient and messaging permissions in Wabb.';
const error = (message, status = 400, code = 'WHATSAPP_INPUT') => Object.assign(new Error(message), { status, code });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const iso = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function phone(value, explicit = true) {
  if (typeof value !== 'string' || value.length > 35 || !/^[+\d ().-]+$/.test(value) || (explicit && !value.trim().startsWith('+')) || (value.match(/\+/g) || []).length > 1 || (value.includes('+') && !value.trim().startsWith('+'))) throw error('Enter an international phone number beginning with + and its country code.');
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{6,14}$/.test(digits)) throw error('Enter a valid international phone number.');
  return '+' + digits;
}
function configuration(env = process.env) {
  let configuredPhone = '';
  try { configuredPhone = phone(env.WABB_PHONE_NUMBER); } catch { /* Report only the setting name. */ }
  const validators = {
    WHATSAPP_PROVIDER: value => value === 'wabb',
    WABB_API_KEY: value => typeof value === 'string' && /^[\x21-\x7e]{16,4096}$/.test(value),
    WABB_WORKSPACE_ID: value => typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value),
    WABB_PHONE_NUMBER: () => !!configuredPhone,
  };
  const missing = REQUIRED.filter(key => !validators[key](env[key]));
  return { configured: !missing.length, missing, key: env.WABB_API_KEY, workspaceId: env.WABB_WORKSPACE_ID, phone: configuredPhone,
    dashboardUrl: validators.WABB_WORKSPACE_ID(env.WABB_WORKSPACE_ID) ? 'https://console.wabb.in/' + env.WABB_WORKSPACE_ID + '/dashboard' : 'https://console.wabb.in/',
    fingerprint: !missing.length ? sha(REQUIRED.map(key => env[key]).join('\0')) : '' };
}

// Only the documented subscriber reads and text-send operation are exposed.
// Returned pagination URLs and account configuration endpoints are never followed.
function createWabbRequest({ fetcher = globalThis.fetch } = {}) {
  return async ({ method = 'GET', path, query = {}, body, key }) => {
    const list = method === 'GET' && path === '/webhook/subscribers/' && Object.keys(query).length === 1 && query.page === 1;
    const lookup = method === 'GET' && /^\/webhook\/subscriber\/get_by_phone\/[1-9]\d{6,14}\/$/.test(path || '') && !Object.keys(query).length;
    const send = method === 'POST' && /^\/webhook\/subscriber\/[1-9]\d{0,15}\/send_message\/$/.test(path || '') && !Object.keys(query).length && object(body) && Object.keys(body).length === 2 && body.type === 'text' && typeof body.value === 'string' && body.value.length <= 4096;
    if (!(list || lookup || send) || typeof key !== 'string' || !/^[\x21-\x7e]{16,4096}$/.test(key)) throw error('The Wabb operation is unavailable.', 503, 'WHATSAPP_CONFIGURATION');
    const url = new URL('https://api.wabb.in/api/v1' + path);
    if (list) url.searchParams.set('page', '1');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher(url.href, { method, headers: { 'API-KEY': key, Accept: 'application/json', ...(send ? { 'Content-Type': 'application/json' } : {}) }, ...(send ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: controller.signal });
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk); bytes += buffer.length;
        if (bytes > 1024 * 1024) throw Object.assign(Error('Response limit'), { httpStatus: response.status, ambiguous: send });
        chunks.push(buffer);
      }
      // HTTP 408 and server errors do not prove whether a message was submitted.
      if (response.status !== 200) throw Object.assign(Error('Provider rejected request'), { httpStatus: response.status, ambiguous: send && (response.status === 408 || response.status >= 500 || response.status < 400) });
      try { return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
      catch { throw Object.assign(Error('Invalid provider response'), { httpStatus: response.status, ambiguous: send }); }
    } catch (failure) {
      if (failure.httpStatus) throw failure;
      throw Object.assign(Error('Provider request unavailable'), { ambiguous: send });
    } finally { clearTimeout(timer); }
  };
}
function attemptDTO(row, at = new Date()) {
  const age = new Date(at).getTime() - new Date(row.createdAt).getTime();
  const stale = row.status === 'sending' && (!Number.isFinite(age) || age >= 120000);
  return { id: String(row._id), status: stale ? 'unknown' : row.status, phone: row.phone, text: row.text, createdAt: iso(row.createdAt), ...(stale ? { error: UNKNOWN } : row.error ? { error: row.error } : {}) };
}

function createWabbService({ Connection = require('../models/WhatsAppConnection'), Attempt = require('../models/WabbMessageAttempt'), env = process.env, request = createWabbRequest(), now = () => new Date() } = {}) {
  const stamp = () => new Date(now());
  const config = () => { const c = configuration(env); if (!c.configured) throw error('Wabb setup is incomplete. Ask the studio owner to configure the backend connection.', 503, 'WHATSAPP_CONFIGURATION'); return c; };
  const fresh = row => { const age = stamp().getTime() - new Date(row?.verifiedAt || NaN).getTime(); return Number.isFinite(age) && age >= 0 && age < DAY; };
  async function status() {
    const c = configuration(env), base = { provider: 'wabb', configured: c.configured, connected: false, apiReady: false, state: 'setup_needed', missing: c.missing, displayPhoneNumber: c.phone, verifiedName: 'Wabb', verifiedAt: null, dashboardUrl: c.dashboardUrl, capabilities: { inbox: false, history: false, templates: false, deliveryReceipts: false, manualText: false } };
    if (!c.configured) return base;
    try {
      const row = await Connection.findOne({ key: 'wabb' }).select('+fingerprint');
      if (!row || row.fingerprint !== c.fingerprint) return { ...base, state: 'verification_needed' };
      const apiReady = row.state === 'api_verified' && fresh(row);
      return { ...base, state: apiReady ? 'wabb_api_ready' : row.state === 'unavailable' ? 'unavailable' : 'verification_needed', apiReady, verifiedAt: iso(row.verifiedAt), capabilities: { ...base.capabilities, manualText: apiReady }, ...(row.error ? { error: row.error } : {}) };
    } catch { return { ...base, state: 'unavailable', error: 'Wabb verification could not be loaded. Try again shortly.' }; }
  }
  async function verifyConnection(actorId) {
    const c = config(); let data;
    try {
      data = await request({ method: 'GET', path: '/webhook/subscribers/', query: { page: 1 }, key: c.key });
      if (!object(data) || !Number.isSafeInteger(data.count) || data.count < 0 || !Array.isArray(data.results) || data.results.length > 1000 || !data.results.every(object) || data.results.length > data.count) throw Error('Invalid subscriber page');
    } catch {
      await Connection.findOneAndUpdate({ key: 'wabb' }, { $set: { fingerprint: c.fingerprint, state: 'unavailable', coexistence: false, displayPhoneNumber: c.phone, verifiedName: 'Wabb', verifiedAt: null, error: 'Wabb API verification failed. Check the backend API key and Wabb service availability.' } }, { upsert: true, new: true });
      throw error('Wabb API verification failed. Check the backend API key and Wabb service availability.', 502, 'WHATSAPP_WABB_VERIFICATION');
    }
    // API-key acceptance is not proof of the connected number or app coexistence.
    await Connection.findOneAndUpdate({ key: 'wabb' }, { $set: { fingerprint: c.fingerprint, state: 'api_verified', coexistence: false, displayPhoneNumber: c.phone, verifiedName: 'Wabb', verifiedAt: stamp(), ...(actorId ? { verifiedBy: actorId } : {}), error: '' } }, { upsert: true, new: true });
    return status();
  }
  async function sendWabb(body, actorId) {
    const c = config();
    if (!object(body) || Object.keys(body).some(key => !['requestId', 'phone', 'text', 'replyWindowConfirmed', 'permissionConfirmed'].includes(key)) || typeof body.requestId !== 'string' || !/^[a-f\d]{32}$/i.test(body.requestId)) throw error('Enter a valid message and retry key.');
    if (body.replyWindowConfirmed !== true || body.permissionConfirmed !== true) throw error('Confirm permission to contact this person and check the WhatsApp reply window in Wabb. Use an approved Wabb template outside the reply window.', 409, 'WHATSAPP_WABB_CONFIRMATION');
    const recipient = phone(body.phone), requestId = body.requestId.toLowerCase();
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.text)) throw error('Enter a plain text message of up to 4096 characters.');
    const text = body.text.trim(), payloadHash = sha(JSON.stringify({ phone: recipient, text, permissionConfirmed: true, replyWindowConfirmed: true }));
    const filter = { workspaceId: c.workspaceId, requestId };
    const prior = row => {
      if (row.payloadHash !== payloadHash || row.fingerprint !== c.fingerprint) throw error('This retry key belongs to a different message or Wabb configuration.', 409, 'WHATSAPP_REQUEST_CONFLICT');
      return { attempt: attemptDTO(row, stamp()) };
    };
    let row = await Attempt.findOne(filter).select('+payloadHash +fingerprint');
    if (row) return prior(row);
    const verification = await Connection.findOne({ key: 'wabb' }).select('+fingerprint');
    if (!verification || verification.fingerprint !== c.fingerprint || verification.state !== 'api_verified' || !fresh(verification)) throw error('Ask the studio owner to verify the Wabb API connection before sending.', 409, 'WHATSAPP_VERIFICATION_REQUIRED');
    let subscriber;
    try { subscriber = await request({ method: 'GET', path: '/webhook/subscriber/get_by_phone/' + recipient.slice(1) + '/', key: c.key }); }
    catch (failure) { if (failure.httpStatus === 404) throw error('This recipient is not saved in Wabb. Add or confirm the contact in Wabb first.', 404, 'WHATSAPP_WABB_RECIPIENT_NOT_FOUND'); throw error('The Wabb recipient could not be verified. Check Wabb and try again.', 502, 'WHATSAPP_WABB_LOOKUP'); }
    let exact = false;
    try { exact = object(subscriber) && phone(subscriber.phone, false) === recipient; } catch { /* An absent or ambiguous number must not be sent to. */ }
    if (!exact || !Number.isSafeInteger(subscriber?.id) || subscriber.id <= 0) throw error('Wabb did not return an exact matching recipient. Check the international phone number in Wabb.', 409, 'WHATSAPP_WABB_RECIPIENT_MISMATCH');
    // An attestation does not establish the provider's reply window. Wabb remains
    // responsible for enforcing its WhatsApp session and template restrictions.
    if (configuration(env).fingerprint !== c.fingerprint) throw error('Wabb configuration changed. Verify the connection again.', 409, 'WHATSAPP_VERIFICATION_REQUIRED');
    try {
      row = await Attempt.create({ ...filter, payloadHash, fingerprint: c.fingerprint, phone: recipient, text, subscriberId: String(subscriber.id), permissionConfirmed: true, replyWindowConfirmed: true, status: 'sending', ...(actorId ? { attemptedBy: actorId } : {}), createdAt: stamp() });
    } catch (failure) {
      if (failure.code !== 11000) throw error('The message could not be recorded safely. Nothing was sent.', 503, 'WHATSAPP_WABB_STORAGE');
      row = await Attempt.findOne(filter).select('+payloadHash +fingerprint');
      if (!row) throw error('The message attempt is unavailable. Check Wabb before trying again.', 503, 'WHATSAPP_WABB_STORAGE');
      return prior(row);
    }
    let result = { status: 'submitted', error: '' };
    try {
      const response = await request({ method: 'POST', path: '/webhook/subscriber/' + subscriber.id + '/send_message/', body: { type: 'text', value: text }, key: c.key });
      if (!object(response) || Object.keys(response).length) result = { status: 'unknown', error: UNKNOWN };
    } catch (failure) {
      const definite = failure.ambiguous !== true && failure.httpStatus >= 400 && failure.httpStatus < 500 && failure.httpStatus !== 408;
      result = definite ? { status: 'failed', error: REJECTED } : { status: 'unknown', error: UNKNOWN };
    }
    try {
      const updated = await Attempt.updateOne({ _id: row._id, ...filter, status: 'sending' }, { $set: result });
      if (updated.matchedCount !== 1) result = { status: 'unknown', error: UNKNOWN };
    } catch {
      result = { status: 'unknown', error: UNKNOWN };
      try { await Attempt.updateOne({ _id: row._id, ...filter, status: 'sending' }, { $set: result }); } catch { /* The durable claim still prevents automatic resubmission. */ }
    }
    return { attempt: attemptDTO({ ...(row.toObject?.() || row), ...result }, stamp()) };
  }
  return { status, verifyConnection, sendWabb };
}

module.exports = { createWabbService, createWabbRequest, configuration, attemptDTO, ...createWabbService() };
