const { google } = require('googleapis');
const { createOAuthStateService, browserCookie } = require('./oauthState');
const { isStudioOwner } = require('./moduleAccess');
const { currentWorkspace } = require('../saas/tenantContext');
const { DRIVE_SCOPE, EMAIL_SCOPE, driveConfiguration, sealDriveTokens, openDriveTokens, createDriveBackupService } = require('../services/driveBackupService');
function createDriveBackupOAuthHandlers({ User = require('../models/User'), Connection = require('../models/DriveBackupConnection'),
  store = require('../models/DriveBackupOAuthNonce'), env = process.env, makeClient, getProfile, now, randomBytes } = {}) {
  const state = createOAuthStateService({ User, store, ...(now ? { now } : {}), ...(randomBytes ? { randomBytes } : {}) });
  const service = createDriveBackupService({ Connection, env, makeClient });
  const owner = async id => { const user = await User.findById(id); if (currentWorkspace() || !user || user.accountDisabled || !isStudioOwner(user, { env, workspace: null })) throw Object.assign(new Error('Only the personal studio owner can connect workspace backup storage.'), { status: 403 }); return user; };
  const prepare = res => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); };
  const failure = res => { try { res.redirect(driveConfiguration(env).frontendOrigin + '/admin/settings?section=backups&driveBackup=error'); } catch { res.status(503).json({ message: 'Google Drive backup configuration is incomplete.' }); } };
  return {
    start: async (req, res) => { prepare(res); try { await owner(req.user.id); const config = driveConfiguration(env), ticket = await state.issue(req.user); res.json({ url: config.beginUrl + '?ticket=' + ticket }); } catch (error) { res.status(error.status || 503).json({ message: error.status === 403 ? error.message : 'Configure the Google Drive backup callback and OAuth client on the backend.' }); } },
    begin: async (req, res) => { prepare(res); try { const config = driveConfiguration(env), flow = await state.begin(req.query?.ticket); await owner(flow.userId);
      const url = service.oauthClient(config).generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [DRIVE_SCOPE, EMAIL_SCOPE], state: flow.state, code_challenge_method: 'S256', code_challenge: flow.codeChallenge });
      res.cookie(config.cookieName, flow.browser, config.cookie); res.redirect(url);
    } catch { failure(res); } },
    callback: async (req, res) => { prepare(res); try {
      const config = driveConfiguration(env), flow = await state.consume(req.query?.state, browserCookie(req, config.cookieName));
      const cookie = { ...config.cookie }; delete cookie.maxAge; res.clearCookie(config.cookieName, cookie);
      await owner(flow.userId);
      if (req.query?.error || typeof req.query?.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw Error('Authorization incomplete');
      const oauth = service.oauthClient(config), { tokens } = await oauth.getToken({ code: req.query.code, codeVerifier: flow.codeVerifier, redirect_uri: config.redirectUri });
      if (!tokens?.access_token) throw Error('No token'); oauth.setCredentials(tokens);
      const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : (await oauth.getTokenInfo(tokens.access_token)).scopes;
      if (!scopes?.includes(DRIVE_SCOPE) || !scopes?.includes(EMAIL_SCOPE)) throw Error('Missing permission');
      const profile = getProfile ? await getProfile(oauth) : (await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get()).data;
      const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
      if (!profile?.verified_email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Unverified account');
      let refresh = tokens.refresh_token;
      if (!refresh) { const existing = await service.connectionFor(flow.userId); if (!existing || existing.email !== email) throw Error('Offline access required'); refresh = openDriveTokens(existing.tokenEnvelope, flow.userId, env).refresh_token; }
      if (!refresh) throw Error('Offline access required'); await owner(flow.userId);
      await Connection.findOneAndUpdate({ userId: flow.userId }, { $set: { email, tokenEnvelope: sealDriveTokens({ access_token: tokens.access_token, refresh_token: refresh, ...(Number.isFinite(tokens.expiry_date) ? { expiry_date: tokens.expiry_date } : {}) }, flow.userId, env), connectedAt: new Date() } }, { upsert: true, runValidators: true });
      res.redirect(config.frontendOrigin + '/admin/settings?section=backups&driveBackup=connected');
    } catch { failure(res); } },
  };
}
module.exports = { createDriveBackupOAuthHandlers };
