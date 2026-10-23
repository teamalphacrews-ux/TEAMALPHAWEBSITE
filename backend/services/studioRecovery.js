const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { fail } = require('./studioSecurity');

// Explicit business-model allowlist: never export users, OAuth connections,
// sessions, mail credentials, vaults, webhook configuration or admin secrets.
const MODEL_NAMES = ['StudioConfig', 'StudioContact', 'StudioProject', 'Lead', 'Quotation', 'Invoice', 'QuoteTemplate', 'ContactDocument', 'Finance', 'Event', 'Photographer', 'Task', 'AssetRecord', 'Gallery', 'Media', 'ProjectMessage'];
const SECRET_KEY = /password|secret|token|credential|authorization|cookie|^iv$|^session|^google(access|refresh|webhook|resource)|^vault/i;
const MAX_BYTES = 8 * 1024 * 1024, MAX_RECORDS = 5000;
function models() { return Object.fromEntries(MODEL_NAMES.map(name => [name, require('../models/' + name)])); }
function safeValue(value, depth = 0) {
  if (depth > 25) throw fail('Record nesting is too deep.', 400);
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(row => safeValue(row, depth + 1));
  if (typeof value === 'object') {
    const result = {};
    for (const [key, row] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) continue;
      if (key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw fail('Unsafe record field.', 400);
      result[key] = safeValue(row, depth + 1);
    }
    return result;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw fail('Invalid record number.', 400);
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw fail('Unsupported record value.', 400);
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value); let changed = !!(url.username || url.password);
      url.username = ''; url.password = '';
      for (const key of [...url.searchParams.keys()]) if (/token|secret|password|credential|authorization|api[_-]?key|signature/i.test(key)) { url.searchParams.delete(key); changed = true; }
      if (changed) return url.href;
    } catch { /* Ordinary business text is kept as plain text. */ }
  }
  return value;
}
function encryptionKey(env = process.env) {
  const secret = env.BACKUP_SECRET || env.VAULT_SECRET;
  if (typeof secret !== 'string' || secret.trim().length < 16) throw fail('Configure a stable BACKUP_SECRET or VAULT_SECRET before using recovery.', 503);
  return crypto.createHash('sha256').update(secret).digest();
}
function seal(value, env) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > MAX_BYTES) throw fail('Snapshot exceeds the 8 MB studio backup limit.', 413);
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
function unseal(value, env) {
  const [iv, tag, data] = String(value).split('.');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const json = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
    if (json.length > MAX_BYTES) throw Error();
    return JSON.parse(json.toString('utf8'));
  } catch { throw fail('This recovery snapshot cannot be decrypted. Its original recovery key is required.', 409); }
}
function validateSnapshot(snapshot, registry = models()) {
  if (!snapshot || snapshot.format !== 'teamalpha-business-records' || snapshot.version !== 1 || !snapshot.collections || typeof snapshot.collections !== 'object' || Array.isArray(snapshot.collections)) throw fail('Unsupported backup format.', 400);
  const clean = {}, seen = new Set(); let count = 0;
  for (const [name, rows] of Object.entries(snapshot.collections)) {
    const Model = registry[name];
    if (!MODEL_NAMES.includes(name) || !Model || !Array.isArray(rows)) throw fail('Unsupported backup collection.', 400);
    clean[name] = [];
    for (const row of rows) {
      if (++count > MAX_RECORDS) throw fail('Backup contains too many records.', 413);
      if (!row || typeof row !== 'object' || Array.isArray(row) || !/^[a-f\d]{24}$/i.test(row._id)) throw fail('Backup contains an invalid record identity.', 400);
      // Reject secrets in a supplied snapshot rather than silently importing them.
      const scrubbed = safeValue(row);
      if (JSON.stringify(scrubbed) !== JSON.stringify(row)) throw fail('Backup contains excluded private fields.', 400);
      const key = name + ':' + row._id;
      if (seen.has(key)) throw fail('Backup contains duplicate records.', 400);
      seen.add(key);
      const roots = new Set(Object.keys(Model.schema.paths).map(path => path.split('.')[0]));
      if (Object.keys(row).some(key => !roots.has(key))) throw fail('Backup contains unknown record fields.', 400);
      const error = new Model(row).validateSync();
      if (error) throw fail('Backup contains invalid ' + name + ' records.', 400);
      clean[name].push(row);
    }
  }
  return { ...snapshot, collections: clean };
}
async function inTransaction(work) {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
  catch (error) {
    if (/Transaction numbers|replica set|not supported/i.test(error.message)) throw fail('Recovery requires a MongoDB replica set such as Atlas. No records were changed.', 503);
    throw error;
  } finally { await session.endSession(); }
}
async function retentionDays() { const config = await require('../models/StudioConfig').findOne({ key: 'studio' }).select('backups').lean(); return config?.backups?.retentionDays || 30; }
async function recoverableDelete({ Model, filter, actorId, label }) {
  await require('./studioSecurity').assertPermission(actorId, 'deletion');
  if (!MODEL_NAMES.includes(Model.modelName)) throw fail('This record type does not support recovery.', 400);
  const Recovery = require('../models/RecoveryRecord');
  const expiresAt = new Date(Date.now() + await retentionDays() * 86400000);
  return inTransaction(async session => {
    const row = await Model.findOne(filter).session(session).lean();
    if (!row) return null;
    const snapshot = { format: 'teamalpha-business-records', version: 1, collections: { [Model.modelName]: [safeValue(row)] } };
    validateSnapshot(snapshot);
    await Recovery.create([{ model: Model.modelName, recordId: String(row._id), label: String(label || row.name || row.title || row.clientName || Model.modelName).slice(0, 200), deletedBy: actorId, encrypted: seal(snapshot), expiresAt }], { session });
    const result = await Model.deleteOne({ ...filter, _id: row._id }, { session });
    if (result.deletedCount !== 1) throw fail('The record changed before deletion. Try again.', 409);
    return row;
  });
}
async function mergeSnapshot(snapshot, session, registry = models()) {
  const clean = validateSnapshot(snapshot, registry), result = { inserted: 0, skipped: 0 }, restoredTasks = [];
  for (const [name, rows] of Object.entries(clean.collections)) {
    if (!rows.length) continue;
    const Model = registry[name], existing = await Model.find({ _id: { $in: rows.map(row => row._id) } }).select('_id').session(session).lean();
    const ids = new Set(existing.map(row => String(row._id))), missing = rows.filter(row => !ids.has(row._id));
    result.skipped += rows.length - missing.length;
    // Restoring records must not restart historical outbound emails or expose a
    // former public link. Studio staff can reissue the restored documents.
    const inserts = missing.map(row => ({ ...row, ...(name === 'Quotation' ? { remindersEnabled: false } : {}), ...(name === 'Invoice' ? { paymentReminders: false, scheduledDelivery: undefined } : {}), ...(name === 'Event' && row.origin === 'google' ? { isReadOnly: true, lastUpdatedFrom: 'google' } : {}) }));
    if (inserts.length) await Model.insertMany(inserts, { session, ordered: true });
    if (name === 'Task') restoredTasks.push(...inserts.filter(row => row.lead));
    result.inserted += missing.length;
  }
  for (const task of restoredTasks) {
    const linked = await registry.Lead.updateOne({ _id: task.lead }, { $addToSet: { tasks: task._id } }, { session });
    if (!linked.matchedCount) throw fail('Restore the linked enquiry before restoring its task. Nothing was changed.', 409);
  }
  return result;
}
async function restoreRecovery({ id, actorId }) {
  await require('./studioSecurity').assertOwner(actorId);
  const Recovery = require('../models/RecoveryRecord');
  return inTransaction(async session => {
    const row = await Recovery.findOne({ _id: id, restoredAt: null, expiresAt: { $gt: new Date() } }).select('+encrypted').session(session);
    if (!row) throw fail('Recoverable record not found or already restored.', 404);
    const result = await mergeSnapshot(unseal(row.encrypted), session);
    if (!result.inserted) throw fail('A record with this identity already exists; it was not overwritten.', 409);
    row.restoredAt = new Date(); await row.save({ session });
    return result;
  });
}
async function createBackup({ actorId, kind = 'manual', slot } = {}) {
  if (kind === 'manual') await require('./studioSecurity').assertOwner(actorId);
  const registry = models(), Backup = require('../models/StudioBackup'), days = await retentionDays();
  const row = await inTransaction(async session => {
    const collections = {}; let count = 0;
    for (const [name, Model] of Object.entries(registry)) {
      const rows = await Model.find().limit(MAX_RECORDS + 1).session(session).lean();
      count += rows.length;
      if (count > MAX_RECORDS) throw fail('Studio backups currently support up to 5,000 business records.', 413);
      collections[name] = rows.map(row => safeValue(row));
    }
    const snapshot = { format: 'teamalpha-business-records', version: 1, createdAt: new Date().toISOString(), collections };
    const encrypted = seal(snapshot);
    const [created] = await Backup.create([{ kind, ...(slot ? { slot } : {}), createdBy: actorId, encrypted, counts: Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, rows.length])), bytes: Buffer.byteLength(JSON.stringify(snapshot)), expiresAt: new Date(Date.now() + days * 86400000) }], { session });
    return created;
  });
  const older = await Backup.find().sort({ createdAt: -1 }).skip(30).select('_id').lean();
  if (older.length) await Backup.deleteMany({ _id: { $in: older.map(row => row._id) } });
  return row;
}
async function runBackupJobs() {
  const config = await require('../models/StudioConfig').findOne({ key: 'studio' }).select('backups').lean();
  if (!config?.backups?.enabled) return;
  const date = new Date(), day = date.toISOString().slice(0, 10);
  const slot = config.backups.frequency === 'weekly' ? 'week-' + Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / (7 * 86400000)) : 'day-' + day;
  if (await require('../models/StudioBackup').exists({ slot })) return;
  try { await createBackup({ kind: 'scheduled', slot }); } catch (e) { if (e.code !== 11000) throw e; }
}
module.exports = { MODEL_NAMES, MAX_BYTES, MAX_RECORDS, safeValue, seal, unseal, validateSnapshot, recoverableDelete, restoreRecovery, createBackup, runBackupJobs, mergeSnapshot, inTransaction };
