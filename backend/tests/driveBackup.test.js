const test = require('node:test');
const assert = require('node:assert/strict');
const { DRIVE_SCOPE, driveConfiguration, sealDriveTokens, openDriveTokens, assertArchiveFile, createDriveBackupService } = require('../services/driveBackupService');
const env = { NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', VAULT_SECRET: 'a'.repeat(32), DRIVE_BACKUP_REDIRECT_URI: 'https://api.example.com/api/integrations/drive-backups/callback', FRONTEND_URL: 'https://studio.example.com' };
const owner = '1234567890abcdef12345678';
test('Drive uses a dedicated callback and least-privilege app-file scope', () => {
  assert.equal(DRIVE_SCOPE, 'https://www.googleapis.com/auth/drive.file');
  assert.equal(driveConfiguration(env).cookie.httpOnly, true); assert.equal(driveConfiguration(env).cookie.secure, true);
  assert.throws(() => driveConfiguration({ ...env, DRIVE_BACKUP_REDIRECT_URI: 'http://api.example.com/callback' }));
  assert.throws(() => driveConfiguration({ ...env, DRIVE_BACKUP_REDIRECT_URI: 'https://api.example.com/api/integrations/gmail/callback' }));
  assert.throws(() => driveConfiguration({ ...env, DRIVE_BACKUP_CLIENT_ID: 'partial' }));
});
test('Drive connection tokens are encrypted and bound to their owner', () => {
  const value = sealDriveTokens({ refresh_token: 'private', access_token: 'value' }, owner, env);
  assert.equal(value.includes('private'), false); assert.equal(openDriveTokens(value, owner, env).refresh_token, 'private');
  assert.throws(() => openDriveTokens(value, 'other-owner', env)); assert.throws(() => openDriveTokens(value.slice(0, -6) + 'invalid', owner, env));
});
test('Only tagged same-owner bounded JSON archives can be downloaded', () => {
  const value = { mimeType: 'application/json', size: '100', appProperties: { studioOSArchive: 'workspace-v1', studioOSOwner: owner } };
  assert.doesNotThrow(() => assertArchiveFile(value, owner));
  for (const file of [{ ...value, trashed: true }, { ...value, size: '9999999999' }, { ...value, mimeType: 'text/html' }, { ...value, appProperties: { ...value.appProperties, studioOSOwner: 'other' } }]) assert.throws(() => assertArchiveFile(file, owner));
});
test('Missing configuration exposes setup status without any secret', async () => {
  const service = createDriveBackupService({ env: {} }); const value = await service.status(owner);
  assert.equal(value.configured, false); assert.equal(value.connected, false); assert.equal(JSON.stringify(value).includes('refresh_token'), false);
});
test('Archive download validates file ownership before requesting file content', async () => {
  let mediaRequested = false;
  const service = createDriveBackupService({ env, Connection: { findOne: () => ({ select: async () => ({ tokenEnvelope: sealDriveTokens({}, owner, env) }) }) }, makeClient: () => ({ setCredentials() {} }), makeDrive: () => ({ files: { get: async options => { if (options.alt) mediaRequested = true; return { data: { mimeType: 'application/json', size: '100', appProperties: { studioOSArchive: 'workspace-v1', studioOSOwner: 'another' } } }; } } }) });
  await assert.rejects(service.download(owner, 'file-id'), /not a workspace archive/); assert.equal(mediaRequested, false);
});
