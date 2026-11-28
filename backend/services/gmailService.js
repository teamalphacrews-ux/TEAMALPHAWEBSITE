const crypto = require('node:crypto');
const { google } = require('googleapis');
const { vaultKey } = require('../utils/vaultCrypto');
const { currentWorkspace } = require('../saas/tenantContext');
const { providerConfig } = require('../saas/socialAuth');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_CALLBACK_PATH = '/api/integrations/gmail/callback';
const SHARED_GOOGLE_CALLBACK_PATH = '/api/saas/oauth/google/callback';
const MESSAGE_ID = /^[a-f0-9]{1,64}$/i;
const BODY_LIMIT = 100000;
const publicError = (message, status = 502, code = 'GMAIL_UNAVAILABLE') => Object.assign(new Error(message), { status, code });

function gmailClient(env) {
  if (env.GMAIL_CLIENT_ID || env.GMAIL_CLIENT_SECRET) return { clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET };
  if (env.SAAS_ENABLED === 'true') return { clientId: env.SAAS_GOOGLE_CLIENT_ID, clientSecret: env.SAAS_GOOGLE_CLIENT_SECRET };
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

function gmailCallbackSettings(env) {
  if (env.SAAS_ENABLED === 'true' && !env.GMAIL_REDIRECT_URI && !env.GMAIL_CLIENT_ID && !env.GMAIL_CLIENT_SECRET) {
    return { path: SHARED_GOOGLE_CALLBACK_PATH, uri: providerConfig('google', env)?.redirectUri };
  }
  return { path: GMAIL_CALLBACK_PATH, uri: env.GMAIL_REDIRECT_URI };
}

function matchesCommercialApi(url, env) {
  if (env.SAAS_ENABLED !== 'true' || !env.API_PUBLIC_URL) return true;
  try { return new URL(env.API_PUBLIC_URL).origin === url.origin; }
  catch { return false; }
}

function gmailConfiguration(env = process.env) {
  const { clientId, clientSecret } = gmailClient(env);
  if (!clientId || !clientSecret) throw publicError('Gmail setup is incomplete. Configure the Google OAuth client on the backend.', 503, 'GMAIL_CONFIGURATION');
  const parse = value => {
    let url;
    try { url = new URL(value); } catch { throw publicError('Gmail setup is incomplete. Configure the Gmail callback and website address.', 503, 'GMAIL_CONFIGURATION'); }
    const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw publicError('Gmail requires secure backend and website addresses.', 503, 'GMAIL_CONFIGURATION');
    return url;
  };
  const callback = gmailCallbackSettings(env);
  const redirect = parse(callback.uri);
  const frontend = parse(env.FRONTEND_URL);
  if (redirect.pathname !== callback.path || redirect.search || redirect.hash || !matchesCommercialApi(redirect, env)) throw publicError('Use this API’s validated Google callback or register its dedicated Gmail callback.', 503, 'GMAIL_CONFIGURATION');
  vaultKey(env);
  const secure = redirect.protocol === 'https:';
  const workspace = currentWorkspace();
  const cookie = workspace ? 'sx_gmail_oauth_' + workspace._id : 'ta_gmail_oauth';
  return { clientId, clientSecret, redirectUri: redirect.href, beginUrl: new URL('/api/integrations/gmail/begin', redirect).href,
    frontendOrigin: frontend.origin, cookieName: secure ? '__Host-' + cookie : cookie,
    cookie: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 10 * 60 * 1000 } };
}

function gmailSetupChecks(env = process.env) {
  const { clientId, clientSecret } = gmailClient(env);
  const callback = gmailCallbackSettings(env);
  const secureAddress = (value, callbackPath) => {
    try {
      const url = new URL(value);
      const local = env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      return !url.username && !url.password && !url.search && !url.hash &&
        (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
        (!callbackPath || (url.pathname === callbackPath && matchesCommercialApi(url, env)));
    } catch { return false; }
  };
  let encryptionReady = false;
  try { vaultKey(env); encryptionReady = true; } catch { /* Return readiness only, never credentials. */ }
  return [
    { id: 'oauth', label: 'Google app credentials', ready: Boolean(clientId && clientSecret), help: 'Save a complete Google OAuth client in the backend’s private settings.' },
    { id: 'callback', label: 'Gmail return address', ready: secureAddress(callback.uri, callback.path), help: 'Verify the studio’s registered Google return address or configure its dedicated Gmail callback in Google Cloud and on the backend.' },
    { id: 'website', label: 'Secure studio website', ready: secureAddress(env.FRONTEND_URL), help: 'Use the current HTTPS Studio OS address for the return to your workspace.' },
    { id: 'encryption', label: 'Private connection storage', ready: encryptionReady, help: 'The backend needs its existing vault key to protect saved Google connections. Keep that key unchanged.' },
  ];
}

function mailboxBinding(userId) {
  const workspace = currentWorkspace();
  return Buffer.from('gmail:' + (workspace ? workspace._id + ':' : '') + String(userId));
}

function sealTokens(tokens, userId, env = process.env) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(env), iv);
  cipher.setAAD(mailboxBinding(userId));
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}
function openTokens(envelope, userId, env = process.env) {
  if (typeof envelope !== 'string' || envelope.length > 40000) throw publicError('Reconnect Gmail to restore this connection.', 409, 'GMAIL_RECONNECT');
  const [version, iv, tag, data, extra] = envelope.split('.');
  if (version !== 'v1' || !iv || !tag || !data || extra !== undefined) throw publicError('Reconnect Gmail to restore this connection.', 409, 'GMAIL_RECONNECT');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(env), Buffer.from(iv, 'base64url'));
    decipher.setAAD(mailboxBinding(userId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'));
  } catch { throw publicError('Reconnect Gmail to restore this connection.', 409, 'GMAIL_RECONNECT'); }
}

function safeGmailError(error) {
  if (error?.code === 'GMAIL_CONFIGURATION' || error?.code === 'GMAIL_RECONNECT' || error?.code === 'GMAIL_INPUT') return error;
  const code = error?.response?.data?.error;
  const status = Number(error?.response?.status || error?.status);
  if (code === 'invalid_grant' || status === 401) return publicError('Gmail permission has expired or was removed. Reconnect your account.', 409, 'GMAIL_RECONNECT');
  if (status === 403) return publicError('Gmail access was denied. Check that the Gmail API is enabled and approve read access when reconnecting.', 403, 'GMAIL_PERMISSION');
  if (status === 429) return publicError('Google is limiting requests. Please wait a moment and try again.', 429, 'GMAIL_RATE_LIMIT');
  if (status === 404) return publicError('This email is no longer available in Gmail.', 404, 'GMAIL_NOT_FOUND');
  return publicError('Gmail could not be loaded. Please try again.', 502);
}

function listOptions(query = {}) {
  const folder = query.folder || 'inbox';
  if (!['inbox', 'sent', 'all'].includes(folder)) throw publicError('Choose Inbox, Sent or All mail.', 400, 'GMAIL_INPUT');
  const text = query.q === undefined ? '' : query.q;
  const page = query.pageToken === undefined ? '' : query.pageToken;
  if (typeof text !== 'string' || text.length > 500 || typeof page !== 'string' || page.length > 2048 || /[\u0000-\u001f]/.test(text + page)) throw publicError('The email search or page is invalid.', 400, 'GMAIL_INPUT');
  return { userId: 'me', maxResults: 25, includeSpamTrash: false,
    ...(folder === 'inbox' ? { labelIds: ['INBOX'] } : folder === 'sent' ? { labelIds: ['SENT'] } : {}),
    ...(text.trim() ? { q: text.trim() } : {}), ...(page ? { pageToken: page } : {}) };
}
const clean = (value, length = 1000) => typeof value === 'string' ? value.replace(/\u0000/g, '').slice(0, length) : '';
function htmlToText(html) {
  // This is text extraction, never HTML sanitization/rendering. The UI uses text nodes only.
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return html.replace(/<(script|style|head|template|noscript)\b[^<>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<\s*br\b[^<>]*>|<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^<>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, code) => {
      if (code[0] !== '#') return entities[code.toLowerCase()] || match;
      const point = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/[\t ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function messageSummary(message, email) {
  const headers = Array.isArray(message.payload?.headers) ? message.payload.headers : [];
  const header = name => clean(headers.find(item => String(item.name).toLowerCase() === name)?.value);
  const id = MESSAGE_ID.test(message.id || '') ? message.id : '';
  const received = new Date(Number(message.internalDate));
  return { id, threadId: MESSAGE_ID.test(message.threadId || '') ? message.threadId : id,
    subject: header('subject') || '(No subject)', from: header('from'), to: header('to'), cc: header('cc'), date: header('date'),
    receivedAt: !Number.isNaN(received.getTime()) ? received.toISOString() : null,
    snippet: clean(message.snippet, 1200), unread: Array.isArray(message.labelIds) && message.labelIds.includes('UNREAD'),
    gmailUrl: 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(email) + '#all/' + id };
}
function messageDetail(message, email) {
  const attachments = [], bodies = [], htmlBodies = [];
  let parts = 0, size = 0, htmlSize = 0, clipped = false;
  const walk = (part, depth = 0) => {
    if (!part || depth > 12 || ++parts > 200) return;
    if (part.filename) attachments.push({ name: clean(part.filename, 200), mimeType: clean(part.mimeType, 100), size: Math.max(0, Number(part.body?.size) || 0) });
    if (!part.filename && part.mimeType === 'text/plain' && typeof part.body?.data === 'string' && size < BODY_LIMIT) {
      const decoded = Buffer.from(part.body.data.slice(0, BODY_LIMIT * 2), 'base64url').toString('utf8');
      const text = clean(decoded, BODY_LIMIT - size);
      bodies.push(text); size += text.length;
      if (part.body.data.length > BODY_LIMIT * 2) clipped = true;
    }
    if (!part.filename && part.mimeType === 'text/html' && typeof part.body?.data === 'string' && htmlSize < BODY_LIMIT) {
      const text = clean(htmlToText(Buffer.from(part.body.data.slice(0, BODY_LIMIT * 3), 'base64url').toString('utf8')), BODY_LIMIT - htmlSize);
      htmlBodies.push(text); htmlSize += text.length;
      if (part.body.data.length > BODY_LIMIT * 3) clipped = true;
    }
    if (Array.isArray(part.parts)) for (const child of part.parts.slice(0, 100)) walk(child, depth + 1);
  };
  walk(message.payload);
  return { ...messageSummary(message, email), body: (bodies.length ? bodies : htmlBodies).join('\n\n'),
    truncated: clipped || size >= BODY_LIMIT || (!bodies.length && htmlSize >= BODY_LIMIT), attachments: attachments.slice(0, 50) };
}

function createGmailService({ Connection = require('../models/GmailConnection'), env = process.env, makeOAuth, makeGmail } = {}) {
  const oauthClient = config => makeOAuth ? makeOAuth(config) : new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  async function connectionFor(userId) { return Connection.findOne({ userId }).select('+tokenEnvelope'); }
  async function status(userId) {
    let configured = false;
    try { gmailConfiguration(env); configured = true; } catch { /* Configuration details never leave the server. */ }
    const record = await Connection.findOne({ userId });
    const needsReconnect = ['GMAIL_RECONNECT', 'GMAIL_PERMISSION'].includes(record?.lastErrorCode);
    return { configured, connected: Boolean(configured && record?.email && !needsReconnect), needsReconnect,
      hasConnection: Boolean(record?.email), email: record?.email || '', connectedAt: record?.connectedAt || null,
      lastError: record?.lastError || '', setupChecks: gmailSetupChecks(env),
      setupMessage: configured ? '' : 'Gmail needs a one-time server setup before you can connect your inbox.' };
  }
  async function withMailbox(userId, read) {
    const config = gmailConfiguration(env);
    const record = await connectionFor(userId);
    if (!record) throw publicError('Connect your Gmail account to view email.', 409, 'GMAIL_RECONNECT');
    const tokens = openTokens(record.tokenEnvelope, userId, env);
    if (!tokens.access_token || !tokens.refresh_token) throw publicError('Reconnect Gmail to restore permission.', 409, 'GMAIL_RECONNECT');
    const oauth = oauthClient(config); oauth.setCredentials(tokens);
    try {
      const gmail = makeGmail ? makeGmail(oauth) : google.gmail({ version: 'v1', auth: oauth });
      const result = await read(gmail, record.email);
      const fresh = { ...tokens, ...oauth.credentials };
      const changed = fresh.access_token !== tokens.access_token || fresh.refresh_token !== tokens.refresh_token || fresh.expiry_date !== tokens.expiry_date;
      await Connection.updateOne({ _id: record._id, userId, tokenEnvelope: record.tokenEnvelope }, { $set: { lastError: '', lastErrorCode: '', ...(changed ? { tokenEnvelope: sealTokens(fresh, userId, env) } : {}) } });
      return result;
    } catch (error) {
      const safe = safeGmailError(error);
      await Connection.updateOne({ _id: record._id, userId, tokenEnvelope: record.tokenEnvelope }, { $set: { lastError: safe.message, lastErrorCode: safe.code } }).catch(() => {});
      throw safe;
    }
  }
  async function list(userId, query) {
    const options = listOptions(query);
    return withMailbox(userId, async (gmail, email) => {
      const { data } = await gmail.users.messages.list(options);
      const messages = Array.isArray(data.messages) ? data.messages.slice(0, 25).filter(item => MESSAGE_ID.test(item.id || '')) : [];
      // Small batches limit API concurrency and keep previews bounded.
      const summaries = [];
      for (let start = 0; start < messages.length; start += 5) {
        summaries.push(...await Promise.all(messages.slice(start, start + 5).map(async item => {
          const result = await gmail.users.messages.get({ userId: 'me', id: item.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'To', 'Cc', 'Date'] });
          return messageSummary(result.data, email);
        })));
      }
      return { messages: summaries, nextPageToken: clean(data.nextPageToken, 2048), resultSizeEstimate: Math.max(0, Number(data.resultSizeEstimate) || 0) };
    });
  }
  async function detail(userId, id) {
    if (!MESSAGE_ID.test(id || '')) throw publicError('This email identifier is invalid.', 400, 'GMAIL_INPUT');
    return withMailbox(userId, async (gmail, email) => messageDetail((await gmail.users.messages.get({ userId: 'me', id, format: 'full' })).data, email));
  }
  return { status, list, detail, connectionFor, oauthClient };
}

module.exports = { GMAIL_SCOPE, GMAIL_CALLBACK_PATH, SHARED_GOOGLE_CALLBACK_PATH, gmailConfiguration, gmailSetupChecks, sealTokens, openTokens, safeGmailError, listOptions, messageSummary, messageDetail, createGmailService, publicError };
