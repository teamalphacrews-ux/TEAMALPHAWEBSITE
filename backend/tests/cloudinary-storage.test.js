const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, PassThrough, Writable } = require('node:stream');
const multer = require('multer');
const { CloudinaryStorage } = require('../storage/cloudinaryStorage');

const boundary = 'studio-upload-compatibility';
const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
const photo = Buffer.from([255, 216, 255, 224, 1, 2, 3, 4, 255, 217]);
function mockClient({ fail = false, onWrite, onFinal } = {}) {
  const log = { options: null, bytes: [], removed: [] };
  const client = { uploader: {
    upload_stream(options, done) {
      log.options = options;
      return new Writable({ write(chunk, _encoding, next) { log.bytes.push(Buffer.from(chunk)); onWrite?.(); next(); },
        final(next) { onFinal?.(done); if (!onFinal) done(fail ? new Error('private SDK diagnostic') : null, { secure_url: 'https://res.cloudinary.com/test/video/upload/photo.jpg', public_id: 'gallery/photo', bytes: Buffer.concat(log.bytes).length, resource_type: 'video' }); next(); },
      });
    },
    destroy(id, options, done) { log.removed.push({ id, options }); done(null, { result: 'ok' }); },
  } };
  return { client, log };
}
function parse(client, { limits, request, body = Buffer.concat([head, photo, tail]) } = {}) {
  const req = request || Readable.from([body]);
  req.headers = { 'content-type': 'multipart/form-data; boundary=' + boundary, 'content-length': String(body.length) };
  const storage = new CloudinaryStorage({ cloudinary: client, params: {
    folder: 'team-alpha-gallery', resource_type: 'auto', public_id: async (_req, file) => 'studio/' + file.originalname,
  } });
  const result = new Promise(resolve => multer({ storage, limits }).single('file')(req, {}, error => resolve({ error, file: req.file })));
  return { req, result };
}

test('current Multer multipart streams through Cloudinary v2 and preserves storage options and result metadata', async () => {
  const { client, log } = mockClient();
  const { error, file } = await parse(client).result;
  assert.equal(error, undefined);
  assert.deepEqual(Buffer.concat(log.bytes), photo);
  assert.deepEqual(log.options, { folder: 'team-alpha-gallery', resource_type: 'auto', public_id: 'studio/photo.jpg' });
  assert.equal(file.path, 'https://res.cloudinary.com/test/video/upload/photo.jpg');
  assert.equal(file.filename, 'gallery/photo'); assert.equal(file.size, photo.length); assert.equal(file.resourceType, 'video');
});

test('provider failure does not claim upload success or expose provider diagnostics', async () => {
  const { client } = mockClient({ fail: true });
  const { error, file } = await parse(client).result;
  assert.match(error.message, /could not upload/);
  assert.doesNotMatch(error.message, /private SDK/);
  assert.equal(file, undefined);
});

test('Multer size rejection removes the uploaded Cloudinary resource with its actual resource type', async () => {
  const { client, log } = mockClient();
  const { error } = await parse(client, { limits: { fileSize: 3 } }).result;
  assert.equal(error.code, 'LIMIT_FILE_SIZE');
  assert.deepEqual(log.removed, [{ id: 'gallery/photo', options: { invalidate: true, resource_type: 'video' } }]);
});

test('aborted multipart input stops the cloud stream and cleans up any late provider asset', { timeout: 1500 }, async () => {
  let started, finishProvider;
  const uploaded = new Promise(resolve => { started = resolve; });
  const { client, log } = mockClient({ onWrite: () => started(), onFinal: done => { finishProvider = done; } });
  const req = new PassThrough();
  const { result } = parse(client, { request: req });
  req.end(Buffer.concat([head, photo, tail]));
  await uploaded;
  // Simulate a network disconnect after parsing but before provider completion.
  await new Promise(resolve => setImmediate(resolve));
  req.aborted = true; req.emit('aborted');
  const { error, file } = await result;
  // Multer listens to request aborts before the StorageEngine does and owns
  // the public error. The adapter must still stop the stream and remove assets.
  assert.match(error.message, /Request aborted|upload was cancelled/);
  assert.equal(file, undefined);
  finishProvider(null, { public_id: 'late/photo', secure_url: 'https://res.cloudinary.com/test/image.jpg', resource_type: 'image' });
  assert.deepEqual(log.removed, [{ id: 'late/photo', options: { invalidate: true, resource_type: 'image' } }]);
});
