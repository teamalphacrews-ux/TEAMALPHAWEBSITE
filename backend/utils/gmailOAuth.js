const { google } = require('googleapis');
const { createOAuthStateService, browserCookie } = require('./oauthState');
const { GMAIL_SCOPE, gmailConfiguration, sealTokens, openTokens, createGmailService, publicError } = require('../services/gmailService');

function createGmailOAuthHandlers({
  User = require('../models/User'), Connection = require('../models/GmailConnection'),
  store = require('../models/GmailOAuthNonce'), env = process.env, now, randomBytes,
  makeClient, getProfile, logger = console,
} = {}) {
  const state = createOAuthStateService({ User, store, ...(now ? { now } : {}), ...(randomBytes ? { randomBytes } : {}) });
  const service = createGmailService({ Connection, env });
  const client = config => makeClient ? makeClient(config) : service.oauthClient(config);
  const prepare = res => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); };
  const failure = (res, stage) => {
    try {
      const config = gmailConfiguration(env);
      res.redirect(config.frontendOrigin + '/admin/email?gmail=error&step=' + stage);
    } catch { res.status(503).json({ message: 'Gmail connection is unavailable. Finish the backend Google connection settings.' }); }
  };
  const diagnose = (stage, error) => {
    const allowed = ['invalid_client', 'invalid_grant', 'access_denied', 'invalid_scope', 'invalid_request', 'insufficient_scope'];
    const candidate = error?.response?.data?.error;
    // Never log provider error objects: they can contain credentials and codes.
    logger.warn('Gmail authorization failed', { stage, providerCode: allowed.includes(candidate) ? candidate : 'unavailable',
      status: [400, 401, 403, 404, 429, 500, 502, 503].includes(Number(error?.response?.status || error?.status)) ? Number(error?.response?.status || error?.status) : null });
  };
  return {
    start: async (req, res) => {
      prepare(res);
      try {
        const config = gmailConfiguration(env);
        const ticket = await state.issue(req.user);
        res.json({ url: config.beginUrl + '?ticket=' + ticket });
      } catch (error) {
        res.status(error.status || 503).json({ message: error.status === 403
          ? 'Sign in with a saved studio administrator account to connect Gmail.'
          : 'Gmail setup is incomplete. Configure its Google client, callback and token encryption on the backend.' });
      }
    },
    begin: async (req, res) => {
      prepare(res);
      try {
        const config = gmailConfiguration(env);
        const flow = await state.begin(req.query?.ticket);
        const url = client(config).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [GMAIL_SCOPE],
          state: flow.state, code_challenge_method: 'S256', code_challenge: flow.codeChallenge });
        res.cookie(config.cookieName, flow.browser, config.cookie);
        res.redirect(url);
      } catch (error) { diagnose('begin', error); failure(res, 'begin'); }
    },
    callback: async (req, res) => {
      prepare(res);
      let step = 'configuration';
      try {
        const config = gmailConfiguration(env);
        step = 'state';
        const flow = await state.consume(req.query?.state, browserCookie(req, config.cookieName));
        const clearOptions = { ...config.cookie }; delete clearOptions.maxAge;
        res.clearCookie(config.cookieName, clearOptions);
        if (req.query?.error || typeof req.query?.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw publicError('Authorization was not completed.', 400);
        const oauth = client(config);
        step = 'token';
        const { tokens } = await oauth.getToken({ code: req.query.code, codeVerifier: flow.codeVerifier, redirect_uri: config.redirectUri });
        if (!tokens || typeof tokens.access_token !== 'string' || !tokens.access_token) throw publicError('Google did not grant Gmail access.', 400);
        oauth.setCredentials(tokens);
        step = 'permission';
        const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : (await oauth.getTokenInfo(tokens.access_token)).scopes;
        if (!Array.isArray(scopes) || !scopes.includes(GMAIL_SCOPE)) throw publicError('Approve read access to connect Gmail.', 400);
        step = 'profile';
        const profile = getProfile ? await getProfile(oauth) : (await google.gmail({ version: 'v1', auth: oauth }).users.getProfile({ userId: 'me' })).data;
        const email = typeof profile?.emailAddress === 'string' ? profile.emailAddress.trim().toLowerCase() : '';
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw publicError('Google could not identify this mailbox.', 400);
        step = 'account';
        if (!await User.findOne({ _id: flow.userId, role: 'admin' })) throw publicError('Administrator access is required.', 403);
        let refresh = typeof tokens.refresh_token === 'string' ? tokens.refresh_token : '';
        const filter = { userId: flow.userId };
        if (!refresh) {
          const existing = await service.connectionFor(flow.userId);
          if (!existing || existing.email !== email) throw publicError('Please reconnect Gmail and approve offline access.', 409);
          refresh = openTokens(existing.tokenEnvelope, flow.userId, env).refresh_token;
          if (!refresh) throw publicError('Please reconnect Gmail and approve offline access.', 409);
          filter.email = email; filter.tokenEnvelope = existing.tokenEnvelope;
        }
        const user = await Connection.findOneAndUpdate(filter, { $set: {
          email, tokenEnvelope: sealTokens({ access_token: tokens.access_token, refresh_token: refresh,
            ...(Number.isFinite(tokens.expiry_date) ? { expiry_date: tokens.expiry_date } : {}) }, flow.userId, env),
          connectedAt: new Date(), lastError: '', lastErrorCode: '',
        } }, { new: true, upsert: Boolean(tokens.refresh_token), runValidators: true });
        if (!user) throw publicError('Please start Gmail connection again.', 409);
        res.redirect(config.frontendOrigin + '/admin/email?gmail=connected');
      } catch (error) { diagnose(step, error); failure(res, step); }
    },
  };
}

module.exports = { createGmailOAuthHandlers };
