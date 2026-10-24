const test = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createSessionVerifier, sessionExpired, tokenHash } = require('../services/studioSecurity');
const { safeValue, seal, unseal, validateSnapshot, mergeSnapshot, MODEL_NAMES } = require('../services/studioRecovery');
const now = Date.UTC(2026, 9, 23, 12), userId = '507f1f77bcf86cd799439011', sid = '507f1f77bcf86cd799439012';
const config = { idleTimeoutMinutes: 60, absoluteSessionHours: 24 };
const row = patch => ({ _id: sid, user: userId, version: 0, createdAt: new Date(now - 3600000), lastSeenAt: new Date(now - 1000), expiresAt: new Date(now + 23 * 3600000), ...patch });
test('session expiry is server-enforced for idle, absolute and explicit revocation', () => {
  assert.equal(sessionExpired(row(), config, now), false);
  for (const value of [row({ revokedAt: new Date() }), row({ lastSeenAt: new Date(now - 3600000) }), row({ createdAt: new Date(now - 86400000) }), row({ expiresAt: new Date(now) })]) assert.equal(sessionExpired(value, config, now), true);
});
test('session verifier binds token, saved session, account identity and session version', async () => {
  let current = row(), writes = 0;
  const verify = createSessionVerifier({ now: () => now, getConfig: async () => config, Session: { findOne: async query => { assert.equal(query.tokenHash, tokenHash('private-token')); return current; }, updateOne: async () => { writes++; return { matchedCount: 1 }; } } });
  const input = { token: 'private-token', decoded: { sid }, user: { _id: userId, role: 'admin', sessionVersion: 0 }, touch: false };
  assert.equal((await verify(input))._id, sid); assert.equal(writes, 0, 'Background requests do not refresh activity');
  await verify({ ...input, touch: true }); assert.equal(writes, 1);
  for (const patch of [{ user: '507f1f77bcf86cd799439099' }, { version: 1 }, { revokedAt: new Date() }, { lastSeenAt: new Date(now - 3600000) }]) { current = row(patch); await assert.rejects(verify(input), e => e.status === 401); }
  current = row(); await assert.rejects(verify({ ...input, decoded: { sid: 'other-session' } }), e => e.status === 401);
  current = null; await assert.rejects(verify({ ...input, decoded: {} }), /sign in again/i); await assert.rejects(verify(input), /session has ended/i);
});
test('revocation racing with activity is not revived', async () => {
  const verify = createSessionVerifier({ now: () => now, getConfig: async () => config, Session: { findOne: async () => row(), updateOne: async () => ({ matchedCount: 0 }) } });
  await assert.rejects(verify({ token: 'private-token', decoded: { sid }, user: { _id: userId, role: 'admin' } }), e => e.status === 401);
});
test('backup allowlist excludes every account, connection and authorization collection', () => {
  for (const name of ['User', 'AdminSettings', 'AdminSession', 'GoogleConnection', 'GmailConnection', 'StudioBackup', 'DriveGallery']) assert.equal(MODEL_NAMES.includes(name), false);
  assert.equal(MODEL_NAMES.includes('StudioConfig'), true);
  const value = safeValue({ name: 'Client', nested: { password: 'private', googleRefreshToken: 'private', webhookSecret: 'private', shareTokenHash: 'private', notes: 'Approved business detail' }, cloudPassword: 'private', vaultPassword: 'private' });
  assert.deepEqual(value, { name: 'Client', nested: { notes: 'Approved business detail' } });
  assert.equal(safeValue('https://user:private@example.test/file?access_token=private&image=1'), 'https://example.test/file?image=1');
});
test('encrypted snapshots authenticate ciphertext and require original private recovery key', () => {
  const env = { VAULT_SECRET: 'synthetic-only-backup-key-with-entropy' }, value = { collections: { name: 'private client records' } };
  const encrypted = seal(value, env); assert.equal(encrypted.includes('private client'), false); assert.deepEqual(unseal(encrypted, env), value);
  assert.throws(() => unseal(encrypted, { VAULT_SECRET: 'another-synthetic-only-backup-key' }), /cannot be decrypted/);
  const parts = encrypted.split('.'); parts[1] = Buffer.alloc(16).toString('base64'); assert.throws(() => unseal(parts.join('.'), env), /cannot be decrypted/);
});
const isolated = new mongoose.Mongoose();
const Contact = isolated.model('RecoveryFixture', new isolated.Schema({ name: { type: String, required: true } }));
const registry = { StudioContact: Contact };
const snapshot = rows => ({ format: 'teamalpha-business-records', version: 1, collections: { StudioContact: rows } });
test('restore validates collection, identities, fields, schema, duplicates and operator injection before writes', () => {
  assert.equal(validateSnapshot(snapshot([{ _id: userId, name: 'Valid' }]), registry).collections.StudioContact.length, 1);
  for (const value of [snapshot([{ _id: 'bad-id', name: 'Invalid' }]), snapshot([{ _id: userId }]), snapshot([{ _id: userId, name: 'A', unknown: true }]), snapshot([{ _id: userId, name: 'A', password: 'private' }]), snapshot([{ _id: userId, name: 'A', $where: 'unsafe' }]), snapshot([{ _id: userId, name: 'A' }, { _id: userId, name: 'B' }]), { ...snapshot([]), collections: { User: [] } }]) assert.throws(() => validateSnapshot(value, registry));
});
test('merge restore inserts only missing IDs and preserves existing records', async () => {
  const writes = [], session = { transaction: true };
  Contact.find = () => ({ session(value) { assert.equal(value, session); return this; }, select() { return this; }, lean: async () => [{ _id: userId }] });
  Contact.insertMany = async (rows, options) => { writes.push(...rows); assert.equal(options.session, session); assert.equal(options.ordered, true); };
  const result = await mergeSnapshot(snapshot([{ _id: userId, name: 'Old snapshot' }, { _id: sid, name: 'Missing record' }]), session, registry);
  assert.deepEqual(result, { inserted: 1, skipped: 1 }); assert.deepEqual(writes, [{ _id: sid, name: 'Missing record' }]);
});
test('restored tasks reattach to their enquiry inside the same transaction', async () => {
  const Task = isolated.model('TaskRecoveryFixture', new isolated.Schema({ title: { type: String, required: true }, lead: isolated.Schema.Types.ObjectId }));
  const session = { transaction: true }, updates = [];
  Task.find = () => ({ select() { return this; }, session() { return this; }, lean: async () => [] });
  Task.insertMany = async (_rows, options) => assert.equal(options.session, session);
  const Lead = { updateOne: async (filter, update, options) => { updates.push({ filter, update, options }); return { matchedCount: 1 }; } };
  const value = { format: 'teamalpha-business-records', version: 1, collections: { Task: [{ _id: sid, title: 'Editing', lead: userId }] } };
  assert.equal((await mergeSnapshot(value, session, { Task, Lead })).inserted, 1);
  assert.deepEqual(updates[0], { filter: { _id: userId }, update: { $addToSet: { tasks: sid } }, options: { session } });
  Lead.updateOne = async () => ({ matchedCount: 0 });
  await assert.rejects(mergeSnapshot(value, session, { Task, Lead }), e => e.status === 409);
});
test('owner-only action rules cannot be satisfied by another administrator', async t => {
  const User = require('../models/User'), security = require('../services/studioSecurity');
  let saved = { _id: userId, role: 'admin', studioOwner: false, email: 'staff@example.test' };
  t.mock.method(User, 'findById', () => ({ select: async () => saved }));
  t.mock.method(security, 'securityConfig', async () => ({ ...config, permissions: { deletion: 'owner_only', exports: 'all_admins' } }));
  await assert.rejects(security.assertPermission(userId, 'deletion'), e => e.status === 403);
  await security.assertPermission(userId, 'exports');
  saved = { ...saved, studioOwner: true }; await security.assertPermission(userId, 'deletion');
  saved = { ...saved, role: 'client' }; await assert.rejects(security.assertPermission(userId, 'exports'), e => e.status === 403);
});
test('revoking a session always filters by the signed-in account', async t => {
  const router = require('../routes/studioSecurityRoutes'), Session = require('../models/AdminSession');
  let filter;
  t.mock.method(Session, 'updateOne', async query => { filter = query; return { matchedCount: 0 }; });
  const route = router.stack.find(layer => layer.route?.path === '/sessions/:id' && layer.route.methods.delete).route;
  const result = {}, response = { status(code) { result.status = code; return this; }, json(body) { result.body = body; } };
  await route.stack.at(-1).handle({ params: { id: sid }, user: { id: userId }, sessionId: userId }, response);
  assert.equal(filter.user, userId); assert.equal(filter._id, sid); assert.equal(result.status, 404);
});
test('transactions fail closed on standalone MongoDB and always release their session', async t => {
  const { inTransaction } = require('../services/studioRecovery'); let ended = false, calls = 0;
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async () => { calls++; throw new Error('Transaction numbers are only allowed on a replica set member'); }, endSession: async () => { ended = true; } }));
  await assert.rejects(inTransaction(async () => assert.fail('No untransactional fallback is allowed')), e => e.status === 503);
  assert.equal(calls, 1); assert.equal(ended, true);
});
