const crypto = require('node:crypto');
const { currentWorkspace } = require('../saas/tenantContext');

function storageKey(env) {
  if (typeof env.VAULT_SECRET !== 'string' || Buffer.byteLength(env.VAULT_SECRET) < 32)
    throw Object.assign(new Error('Calendar connection storage is unavailable.'), { status: 503 });
  return crypto.hkdfSync('sha256', env.VAULT_SECRET, '', 'Studio X OS calendar tokens v1', 32);
}

function calendarCredential(value, userId, field, operation, env = process.env) {
  const workspace = currentWorkspace();
  if (!workspace) return value;
  const aad = Buffer.from([workspace._id, String(userId), field].join(':'));
  if (operation === 'seal') {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', storageKey(env), iv);
    cipher.setAAD(aad);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }
  const [version, iv, tag, data, extra] = String(value).split('.');
  if (version !== 'v1' || !iv || !tag || !data || extra !== undefined) throw new Error('Reconnect Google Calendar to restore access.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', storageKey(env), Buffer.from(iv, 'base64url'));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports = { storageKey, calendarCredential };
