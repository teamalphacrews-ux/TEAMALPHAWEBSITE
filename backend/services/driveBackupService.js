const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { google } = require('googleapis');
const { vaultKey } = require('../utils/vaultCrypto');
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const MAX_FILE_BYTES = 48 * 1024 * 1024;
const fail = (message, status = 503, code = 'DRIVE_BACKUP_UNAVAILABLE') => Object.assign(new Error(message), { status, code });
function driveConfiguration(env = process.env) {
  const dedicated = Boolean(env.DRIVE_BACKUP_CLIENT_ID || env.DRIVE_BACKUP_CLIENT_SECRET);
  const clientId = dedicated ? env.DRIVE_BACKUP_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const clientSecret = dedicated ? env.DRIVE_BACKUP_CLIENT_SECRET : env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw fail('Configure the Google Drive OAuth client in the backend’s private settings.', 503, 'DRIVE_BACKUP_CONFIGURATION');
  const parse = value => { let url; try { url = new URL(value); } catch { throw fail('Configure the Google Drive callback and studio website address.', 503, 'DRIVE_BACKUP_CONFIGURATION'); }
    const local = env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw fail('Google Drive requires secure callback and website addresses.', 503, 'DRIVE_BACKUP_CONFIGURATION'); return url; };
  const callback = parse(env.DRIVE_BACKUP_REDIRECT_URI), frontend = parse(env.FRONTEND_URL);
  if (callback.pathname !== '/api/integrations/drive-backups/callback') throw fail('Register /api/integrations/drive-backups/callback as the Google Drive return address.', 503, 'DRIVE_BACKUP_CONFIGURATION');
  vaultKey(env); const secure = callback.protocol === 'https:';
  return { clientId, clientSecret, redirectUri: callback.href, beginUrl: new URL('/api/integrations/drive-backups/begin', callback).href,
    frontendOrigin: frontend.origin, cookieName: secure ? '__Host-ta_drive_backup' : 'ta_drive_backup', cookie: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 600000 } };
}
function sealDriveTokens(tokens, userId, env = process.env) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(env), iv);
  cipher.setAAD(Buffer.from('studio-drive-backups:' + String(userId)));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
function openDriveTokens(envelope, userId, env = process.env) {
  try { if (typeof envelope !== 'string' || envelope.length > 40000) throw Error(); const [version, iv, tag, data, extra] = envelope.split('.');
    if (version !== 'v1' || extra !== undefined || !iv || !tag || !data) throw Error();
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(env), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from('studio-drive-backups:' + String(userId))); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'));
  } catch { throw fail('Reconnect Google Drive to restore backup access.', 409, 'DRIVE_BACKUP_RECONNECT'); }
}
function safeDriveError(error) {
  if (error?.code?.startsWith?.('DRIVE_BACKUP_')) return error;
  const status = Number(error?.response?.status || error?.status), code = error?.response?.data?.error;
  if (status === 401 || code === 'invalid_grant') return fail('Google Drive permission expired. Reconnect your account.', 409, 'DRIVE_BACKUP_RECONNECT');
  if (status === 403) return fail('Google Drive denied access. Check the Drive API configuration and available storage.', 403, 'DRIVE_BACKUP_PERMISSION');
  if (status === 429) return fail('Google Drive is limiting requests. Please try again shortly.', 429, 'DRIVE_BACKUP_RATE_LIMIT');
  return fail('Google Drive backup could not be completed. Your workspace data has not been reset.', 502);
}
const tags = userId => ({ studioOSArchive: 'workspace-v1', studioOSOwner: String(userId) });
function assertArchiveFile(file, userId) {
  const required = tags(userId);
  if (!file || file.trashed || file.mimeType !== 'application/json' || Object.entries(required).some(([key,value]) => file.appProperties?.[key] !== value)) throw fail('This file is not a workspace archive from your Studio OS account.', 404, 'DRIVE_BACKUP_FILE');
  if (!Number.isSafeInteger(Number(file.size)) || Number(file.size) < 1 || Number(file.size) > MAX_FILE_BYTES) throw fail('This backup exceeds the supported file size.', 413, 'DRIVE_BACKUP_FILE');
}
function createDriveBackupService({ Connection = require('../models/DriveBackupConnection'), env = process.env,
  makeClient, makeDrive, archiveService, } = {}) {
  const oauthClient = config => makeClient ? makeClient(config) : new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  const connectionFor = userId => Connection.findOne({ userId }).select('+tokenEnvelope');
  const withDrive = async (userId, action) => {
    const config = driveConfiguration(env), connection = await connectionFor(userId);
    if (!connection) throw fail('Connect Google Drive before saving a cloud backup.', 409, 'DRIVE_BACKUP_RECONNECT');
    const tokens = openDriveTokens(connection.tokenEnvelope, userId, env), oauth = oauthClient(config); oauth.setCredentials(tokens);
    try { const result = await action(makeDrive ? makeDrive(oauth) : google.drive({ version: 'v3', auth: oauth }));
      const current = oauth.credentials || tokens;
      if (current.access_token && current.access_token !== tokens.access_token) await Connection.updateOne({ userId, tokenEnvelope: connection.tokenEnvelope }, { $set: { tokenEnvelope: sealDriveTokens({ ...tokens, ...current }, userId, env) } });
      return result;
    } catch (error) { throw safeDriveError(error); }
  };
  const archives = () => archiveService || require('./studioArchive');
  return { oauthClient, connectionFor,
    status: async userId => { try { driveConfiguration(env); } catch (error) { return { configured: false, connected: false, message: error.message }; } const row = await Connection.findOne({ userId }); return { configured: true, connected: Boolean(row), ...(row ? { email: row.email, connectedAt: row.connectedAt } : {}) }; },
    list: userId => withDrive(userId, async client => {
      const escaped = String(userId); if (!/^[a-f0-9]{24}$/i.test(escaped)) throw fail('Owner account is invalid.', 403, 'DRIVE_BACKUP_FILE');
      const { data } = await client.files.list({ pageSize: 30, orderBy: 'createdTime desc', q: "trashed = false and appProperties has { key='studioOSArchive' and value='workspace-v1' } and appProperties has { key='studioOSOwner' and value='" + escaped + "' }", fields: 'files(id,name,createdTime,size,mimeType,appProperties,trashed)' });
      return { files: (data.files || []).filter(file => { try { assertArchiveFile(file, userId); return true; } catch { return false; } }).map(({ id, name, createdTime, size }) => ({ id, name, createdTime, size })) };
    }),
    upload: (userId, backupId) => withDrive(userId, async client => {
      const envelope = await archives().readStoredArchive({ actorId: userId, backupId });
      const content = JSON.stringify(envelope); if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw fail('Archive is too large for cloud backup.', 413, 'DRIVE_BACKUP_FILE');
      const name = 'studio-os-workspace-' + new Date().toISOString().replace(/[:.]/g, '-') + '.studioos.json';
      const { data } = await client.files.create({ requestBody: { name, mimeType: 'application/json', appProperties: tags(userId) }, media: { mimeType: 'application/json', body: Readable.from([content]) }, fields: 'id,name,createdTime,size' });
      return { file: data };
    }),
    download: (userId, fileId) => withDrive(userId, async client => {
      if (typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(fileId)) throw fail('Choose a valid backup file.', 400, 'DRIVE_BACKUP_FILE');
      const { data: metadata } = await client.files.get({ fileId, fields: 'id,name,size,mimeType,appProperties,trashed' }); assertArchiveFile(metadata, userId);
      const { data: stream } = await client.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      const chunks = []; let bytes = 0; for await (const chunk of stream) { const value = Buffer.from(chunk); bytes += value.length; if (bytes > MAX_FILE_BYTES) { stream.destroy?.(); throw fail('Backup file is too large.', 413, 'DRIVE_BACKUP_FILE'); } chunks.push(value); }
      const content = Buffer.concat(chunks); let archive; try { archive = JSON.parse(content.toString('utf8')); } catch { throw fail('This is not a readable backup file.', 400, 'DRIVE_BACKUP_FILE'); }
      await archives().inspectPortableArchive({ actorId: userId, archive });
      return { archive, name: 'studio-os-' + metadata.id + '.studioos.json' };
    }),
  };
}
module.exports = { DRIVE_SCOPE, EMAIL_SCOPE, MAX_FILE_BYTES, driveConfiguration, sealDriveTokens, openDriveTokens, safeDriveError, assertArchiveFile, createDriveBackupService };
