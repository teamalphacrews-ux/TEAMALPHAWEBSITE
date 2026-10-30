const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Image = require('../models/StudioProfileImage');
const mailer = require('../services/studioMailer');
const Lease = require('../models/StudioOperationLease');
const profile = require('../routes/studioProfileRoutes');
const communication = require('../routes/studioCommunicationRoutes');
const admin = '507f1f77bcf86cd79943fd01', client = '507f1f77bcf86cd79943fd02';
test.beforeEach(require('./sessionFixture'));
test.beforeEach(t => {
  process.env.JWT_SECRET = 'studio-communication-test-only';
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: id === admin ? 'admin' : 'client', email: id === admin ? 'owner@example.test' : 'client@example.test' }) }));
});
function request(router, url, { role = 'admin', body = {}, raw, method = 'POST', headers = {} } = {}) {
  const token = role ? jwt.sign({ user: { id: role === 'admin' ? admin : client, role } }, process.env.JWT_SECRET) : '';
  const req = raw ? Readable.from([raw]) : {};
  Object.assign(req, { method, url, body, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, header: name => name.toLowerCase() === 'authorization' ? 'Bearer ' + token : undefined });
  return new Promise((resolve, reject) => router.handle(req, { statusCode: 200, headers: {}, set(key, value) { if (typeof key === 'object') Object.assign(this.headers, key); else this.headers[key] = value; return this; }, status(n) { this.statusCode = n; return this; }, json(body) { resolve({ status: this.statusCode, body, headers: this.headers }); }, send(body) { resolve({ status: this.statusCode, body, headers: this.headers }); }, sendStatus(n) { resolve({ status: n }); } }, error => error ? reject(error) : resolve({ status: 404 })));
}
test('profile uploads and email settings reject anonymous and client accounts', async () => {
  for (const [router, url] of [[profile, '/profile-images'], [communication, '/email/test']]) {
    assert.equal((await request(router, url, { role: null })).status, 401);
    assert.equal((await request(router, url, { role: 'client' })).status, 403);
  }
});
test('profile images persist only validated image bytes and return a public brand asset URL', async t => {
  let saved;
  t.mock.method(Image, 'create', async values => { saved = values; return { _id: admin }; });
  const bytes = Buffer.from([255, 216, 255, 224, 0, 16, 255, 217]), boundary = 'profile-image-test';
  const raw = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="logo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const result = await request(profile, '/profile-images', { raw, headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(raw.length) } });
  assert.equal(result.status, 201); assert.equal(saved.uploadedBy, admin); assert.deepEqual(saved.data, bytes);
  assert.equal(result.body.url, '/api/studio/profile-images/' + admin);
  t.mock.method(Image, 'findById', () => ({ select: async () => saved }));
  const asset = await request(profile, '/profile-images/' + admin, { method: 'GET', role: null });
  assert.equal(asset.headers['X-Content-Type-Options'], 'nosniff'); assert.equal(asset.headers['Content-Type'], 'image/jpeg'); assert.deepEqual(asset.body, bytes);
  assert.equal((await request(profile, '/profile-images/not-an-id', { method: 'GET', role: null })).status, 404);
});
test('test email cannot target another recipient and uses a persisted per-account cooldown', async t => {
  let recipient, lease;
  t.mock.method(mailer, 'mailerReady', () => true);
  t.mock.method(mailer, 'sendStudioMail', async values => { recipient = values.to; });
  t.mock.method(Lease, 'findOneAndUpdate', async filter => { lease = filter; });
  assert.equal((await request(communication, '/email/test', { body: { to: 'other@example.test' } })).status, 400);
  assert.equal((await request(communication, '/email/test')).status, 200);
  assert.equal(recipient, 'owner@example.test'); assert.equal(lease._id, 'mail-test:' + admin);
  t.mock.method(Lease, 'findOneAndUpdate', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  assert.equal((await request(communication, '/email/test')).status, 429);
});
test('email connection status returns no credentials and unconfigured delivery cannot claim success', async t => {
  t.mock.method(mailer, 'mailerReady', () => false);
  const status = await request(communication, '/email/status', { method: 'GET' });
  assert.deepEqual(Object.keys(status.body).sort(), ['configured', 'sender']); assert.equal(status.headers['Cache-Control'], 'no-store');
  assert.equal((await request(communication, '/email/test')).status, 503);
});
