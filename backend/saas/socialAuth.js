const crypto = require('node:crypto');
const net = require('node:net');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { failure } = require('./access');

const FLOW_MS = 10 * 60 * 1000;
const HEX_TOKEN = /^[a-f\d]{64}$/;
const providers = Object.freeze({
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', keys: 'https://www.googleapis.com/oauth2/v3/certs', issuer: ['https://accounts.google.com', 'accounts.google.com'] },
  apple: { authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', keys: 'https://appleid.apple.com/auth/keys', issuer: 'https://appleid.apple.com' },
});
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');
function equalHash(value, hash) {
  return typeof value === 'string' && typeof hash === 'string' && HEX_TOKEN.test(hash) && crypto.timingSafeEqual(Buffer.from(digest(value), 'hex'), Buffer.from(hash, 'hex'));
}
function webUrl(value, { development = false, apple = false } = {}) {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search || (url.protocol !== 'https:' && !(development && !apple && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')))
    throw new Error('Invalid authentication URL');
  if (apple && (url.hostname === 'localhost' || net.isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.'))) throw new Error('Apple requires a public HTTPS domain');
  return url;
}
function frontendOrigin(env) {
  return webUrl(env.FRONTEND_URL, { development: env.NODE_ENV !== 'production' }).origin;
}
function providerConfig(provider, env = process.env) {
  if (!Object.hasOwn(providers, provider)) return null;
  const prefix = 'SAAS_' + provider.toUpperCase() + '_';
  try {
    const front = frontendOrigin(env);
    const callback = webUrl(env[prefix + 'REDIRECT_URI'], { development: env.NODE_ENV !== 'production', apple: provider === 'apple' });
    if (callback.pathname !== '/api/saas/oauth/' + provider + '/callback') return null;
    const clientId = env[prefix + 'CLIENT_ID'];
    if (typeof clientId !== 'string' || !clientId || clientId.length > 255 || /\s/.test(clientId)) return null;
    if (provider === 'google') {
      if (!clientId.endsWith('.apps.googleusercontent.com') || !env.SAAS_GOOGLE_CLIENT_SECRET) return null;
      return { clientId, clientSecret: env.SAAS_GOOGLE_CLIENT_SECRET, redirectUri: callback.href, frontendOrigin: front };
    }
    if (!/^[A-Z0-9]{10}$/.test(env.SAAS_APPLE_TEAM_ID || '') || !/^[A-Z0-9]{10}$/.test(env.SAAS_APPLE_KEY_ID || '')) return null;
    const privateKey = crypto.createPrivateKey((env.SAAS_APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'));
    if (privateKey.asymmetricKeyType !== 'ec' || !['prime256v1', 'P-256'].includes(privateKey.asymmetricKeyDetails?.namedCurve)) return null;
    return { clientId, privateKey, teamId: env.SAAS_APPLE_TEAM_ID, keyId: env.SAAS_APPLE_KEY_ID, redirectUri: callback.href, frontendOrigin: front };
  } catch { return null; }
}
function publicProviderStatus(env = process.env) {
  return Object.fromEntries(Object.keys(providers).map(provider => [provider, { enabled: env.SAAS_ENABLED === 'true' && Boolean(providerConfig(provider, env)) }]));
}
function displayName(value) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : ''; }
async function readJson(response) {
  if (!response.ok || Number(response.headers?.get?.('content-length')) > 128000) throw failure(502, 'The identity provider could not confirm sign-in. Please retry.');
  const text = await response.text();
  if (text.length > 128000) throw failure(502, 'The identity provider response was invalid.');
  try { return JSON.parse(text); } catch { throw failure(502, 'The identity provider response was invalid.'); }
}
function createIdTokenVerifier({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  async function keys(provider, refresh = false) {
    const cached = cache.get(provider);
    if (!refresh && cached && cached.until > now()) return cached.keys;
    const payload = await readJson(await fetchImpl(providers[provider].keys, { redirect: 'error', signal: AbortSignal.timeout(8000) }));
    if (!Array.isArray(payload.keys) || payload.keys.length > 30) throw failure(502, 'Identity verification keys are unavailable.');
    cache.set(provider, { keys: payload.keys, until: now() + 10 * 60000 });
    return payload.keys;
  }
  return async function verifyIdToken(provider, token, { clientId, nonceHash }) {
    if (!Object.hasOwn(providers, provider) || typeof token !== 'string' || token.length > 16000) throw failure(401, 'Identity verification failed.');
    const decoded = jwt.decode(token, { complete: true });
    if (decoded?.header?.alg !== 'RS256' || typeof decoded.header.kid !== 'string' || decoded.header.kid.length > 200) throw failure(401, 'Identity verification failed.');
    let candidates = await keys(provider);
    if (!candidates.some(key => key.kid === decoded.header.kid)) candidates = await keys(provider, true);
    const key = candidates.find(item => item.kid === decoded.header.kid && item.kty === 'RSA' && (!item.use || item.use === 'sig') && (!item.alg || item.alg === 'RS256'));
    if (!key) throw failure(401, 'Identity verification failed.');
    let claims;
    try {
      claims = jwt.verify(token, crypto.createPublicKey({ key, format: 'jwk' }), { algorithms: ['RS256'], issuer: providers[provider].issuer, audience: clientId, clockTimestamp: Math.floor(now() / 1000), clockTolerance: 30, maxAge: '10m' });
    } catch { throw failure(401, 'Identity verification failed.'); }
    const stamp = now() / 1000;
    if (claims.aud !== clientId || !Number.isFinite(claims.exp) || claims.exp <= stamp || !Number.isFinite(claims.iat) || claims.iat > stamp + 30 || !equalHash(claims.nonce, nonceHash)
      || typeof claims.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(claims.sub)
      || ![true, 'true'].includes(claims.email_verified) || typeof claims.email !== 'string' || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)
      || (claims.azp !== undefined && claims.azp !== clientId)) throw failure(401, 'Identity verification failed.');
    return { subject: claims.sub, email: claims.email.toLowerCase(), firstName: displayName(claims.given_name), lastName: displayName(claims.family_name) };
  };
}

function createSocialAuth({ models = require('./models'), service = require('./service'), env = process.env, fetchImpl = fetch, now = Date.now, tokenFactory = randomToken, verifyIdToken = createIdTokenVerifier({ fetchImpl, now }) } = {}) {
  const enabled = () => { if (env.SAAS_ENABLED !== 'true') throw failure(503, 'Studio account sign-in is not enabled yet.'); };
  const configured = provider => { enabled(); const config = providerConfig(provider, env); if (!config) throw failure(503, 'This sign-in option is not configured yet.'); return config; };
  async function start(provider, purpose) {
    const config = configured(provider);
    if (!['signup', 'login'].includes(purpose)) throw failure(400, 'Choose sign up or sign in.');
    if (purpose === 'signup' && env.SAAS_SIGNUP_ENABLED !== 'true') throw failure(503, 'New studio registration is not open yet.');
    const state = tokenFactory(), browserProof = tokenFactory(), nonce = tokenFactory(), pkceVerifier = tokenFactory();
    await models.OAuthFlow.create({ provider, purpose, stateHash: digest(state), proofHash: digest(browserProof), nonceHash: digest(nonce), ...(provider === 'google' ? { pkceVerifier } : {}), expiresAt: new Date(now() + FLOW_MS), status: 'pending' });
    const url = new URL(providers[provider].authorize);
    const params = { client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: provider === 'google' ? 'openid email profile' : 'name email', state, nonce };
    if (provider === 'google') { params.code_challenge = crypto.createHash('sha256').update(pkceVerifier).digest('base64url'); params.code_challenge_method = 'S256'; params.prompt = 'select_account'; }
    else params.response_mode = 'form_post';
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return { authorizationUrl: url.href, browserProof };
  }
  async function callback(provider, body) {
    const config = configured(provider);
    if (!HEX_TOKEN.test(body?.state || '')) throw failure(401, 'The sign-in request has expired.');
    const flow = await models.OAuthFlow.findOneAndUpdate({ provider, stateHash: digest(body.state), status: 'pending', expiresAt: { $gt: new Date(now()) } }, { $set: { status: 'exchanging' } }, { new: true }).select('+nonceHash +pkceVerifier');
    if (!flow) throw failure(401, 'The sign-in request has expired.');
    try {
      if (body.error) throw failure(400, 'Sign-in was cancelled.');
      if (typeof body.code !== 'string' || body.code.length < 1 || body.code.length > 4096) throw failure(401, 'Identity verification failed.');
      const clientSecret = provider === 'google' ? config.clientSecret : jwt.sign({ iss: config.teamId, sub: config.clientId, aud: 'https://appleid.apple.com', iat: Math.floor(now() / 1000), exp: Math.floor(now() / 1000) + 300 }, config.privateKey, { algorithm: 'ES256', keyid: config.keyId });
      const fields = new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret, grant_type: 'authorization_code', code: body.code, redirect_uri: config.redirectUri });
      if (provider === 'google') fields.set('code_verifier', flow.pkceVerifier);
      const result = await readJson(await fetchImpl(providers[provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fields.toString(), redirect: 'error', signal: AbortSignal.timeout(8000) }));
      const profile = await verifyIdToken(provider, result.id_token, { clientId: config.clientId, nonceHash: flow.nonceHash });
      if (provider === 'apple' && typeof body.user === 'string' && body.user.length <= 4096) {
        // Apple returns name once. This untrusted display text never determines identity/email.
        try { const name = JSON.parse(body.user)?.name; profile.firstName = displayName(name?.firstName); profile.lastName = displayName(name?.lastName); } catch { /* Ask for display names at onboarding instead. */ }
      }
      const ticket = tokenFactory();
      const resultUpdate = await models.OAuthFlow.updateOne({ _id: flow._id, status: 'exchanging', expiresAt: { $gt: new Date(now()) } }, { $set: { status: 'ready', ticketHash: digest(ticket), profile }, $unset: { pkceVerifier: 1, nonceHash: 1 } });
      if (!resultUpdate.modifiedCount) throw failure(401, 'The sign-in request has expired.');
      return { ticket, redirect: config.frontendOrigin + '/studio-os/auth/callback#ticket=' + ticket };
    } catch (error) {
      await models.OAuthFlow.updateOne({ _id: flow._id, status: 'exchanging' }, { $set: { status: 'failed' }, $unset: { pkceVerifier: 1, nonceHash: 1 } }).catch(() => {});
      throw error;
    }
  }
  async function activeMembership(account) {
    const members = await models.Membership.find({ accountId: account._id, state: 'active' }).sort({ createdAt: 1 });
    for (const membership of members) {
      const workspace = await models.Workspace.findOne({ _id: membership.workspaceId, state: 'active' });
      if (workspace) return { workspace, membership };
    }
    return null;
  }
  async function providerAccount(flow) {
    const account = await models.Account.findOne({ oauthProvider: flow.provider, oauthSubject: flow.profile.subject });
    if (account?.state !== 'active' && account) throw failure(403, 'This account is not available.');
    if (!account && await models.Account.exists({ email: flow.profile.email })) throw failure(409, 'This email already has a Studio OS account. Sign in using the method you originally used; accounts are not linked automatically.');
    return account;
  }
  async function complete(body, req) {
    enabled();
    if (!HEX_TOKEN.test(body?.ticket || '') || !HEX_TOKEN.test(body?.browserProof || '')) throw failure(401, 'Return to sign in and start again.');
    const filter = { ticketHash: digest(body.ticket), status: 'ready', expiresAt: { $gt: new Date(now()) } };
    const flow = await models.OAuthFlow.findOne(filter).select('+proofHash');
    if (!flow || !equalHash(body.browserProof, flow.proofHash)) throw failure(401, 'Return to sign in and start again.');
    let account = await providerAccount(flow);
    let existing = account && await activeMembership(account);
    if (!existing) {
      if (env.SAAS_SIGNUP_ENABLED !== 'true') throw failure(403, 'No active studio is available and new registration is not open yet.');
      if (!body.studioName) return { needsWorkspace: true, profile: { email: flow.profile.email, firstName: flow.profile.firstName, lastName: flow.profile.lastName } };
    }
    // Validate before claiming, so a mistyped display name can be corrected safely.
    const name = !existing ? service.text(body.studioName, 'studio name') : null;
    const firstName = !existing ? service.text(body.firstName || flow.profile.firstName, 'first name') : null;
    const lastNameInput = body.lastName ?? flow.profile.lastName ?? '';
    const lastName = !existing && lastNameInput !== '' ? service.text(lastNameInput, 'last name') : '';
    const claimed = await models.OAuthFlow.findOneAndUpdate({ ...filter, proofHash: digest(body.browserProof) }, { $set: { status: 'completing' } }, { new: true });
    if (!claimed) throw failure(409, 'This sign-in is already being completed. Please sign in again if it does not finish.');
    let lease = null;
    try {
      if (!account) {
        try {
          // No password supplied by the client; this random password is unusable and never returned.
          account = await models.Account.create({ email: flow.profile.email, firstName, lastName, oauthProvider: flow.provider, oauthSubject: flow.profile.subject, passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12) });
        } catch (error) {
          if (error.code !== 11000) throw error;
          account = await providerAccount(flow);
          if (!account) throw failure(409, 'This account is being created. Please sign in again.');
        }
      }
      if (!existing) {
        lease = tokenFactory();
        const locked = await models.Account.findOneAndUpdate({ _id: account._id, state: 'active', $or: [{ socialProvisioningUntil: { $exists: false } }, { socialProvisioningUntil: { $lte: new Date(now()) } }] }, { $set: { socialProvisioningToken: lease, socialProvisioningUntil: new Date(now() + FLOW_MS) } }, { new: true });
        if (!locked) { lease = null; throw failure(409, 'Your studio is already being prepared. Wait briefly and sign in again.'); }
        // Another browser may already have completed the same identity while this flow was open.
        existing = await activeMembership(account);
        if (!existing) existing = await service.provisionWorkspace(account, name);
      }
      if (!await models.Account.exists({ _id: account._id, state: 'active' })) throw failure(403, 'This account is not available.');
      const consumed = await models.OAuthFlow.updateOne({ _id: flow._id, status: 'completing', expiresAt: { $gt: new Date(now()) } }, { $set: { status: 'consumed' }, $unset: { profile: 1, proofHash: 1 } });
      if (!consumed.modifiedCount) throw failure(401, 'The sign-in request has expired.');
      return await service.issueSession(account, existing.workspace, existing.membership, req);
    } catch (error) {
      await models.OAuthFlow.updateOne({ _id: flow._id, status: 'completing' }, { $set: { status: 'failed' }, $unset: { profile: 1, proofHash: 1 } }).catch(() => {});
      throw error;
    } finally {
      if (lease && account) await models.Account.updateOne({ _id: account._id, socialProvisioningToken: lease }, { $unset: { socialProvisioningToken: 1, socialProvisioningUntil: 1 } }).catch(() => {});
    }
  }
  return { start, callback, complete };
}
module.exports = { createSocialAuth, createIdTokenVerifier, providerConfig, publicProviderStatus, frontendOrigin, digest, equalHash };
