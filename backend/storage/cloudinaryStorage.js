// Multer StorageEngine backed by the application's current Cloudinary v2 SDK.
// No adapter-owned SDK or legacy peer dependency is required.
class CloudinaryStorage {
  constructor({ cloudinary, params = {} } = {}) {
    if (typeof cloudinary?.uploader?.upload_stream !== 'function' || typeof cloudinary?.uploader?.destroy !== 'function')
      throw new TypeError('A Cloudinary upload client is required.');
    this.client = cloudinary;
    this.params = params;
  }

  _handleFile(req, file, callback) {
    let destination, settled = false, options = {};
    const clean = () => {
      req.removeListener('aborted', cancel);
      file.stream.removeListener('error', sourceError);
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clean();
      if (error) {
        file.stream.unpipe(destination);
        destination?.destroy();
        file.stream.resume();
      }
      callback(error, result);
    };
    const cancel = () => finish(Object.assign(new Error('The media upload was cancelled.'), { code: 'UPLOAD_CANCELLED' }));
    const sourceError = error => finish(error);
    req.once('aborted', cancel);
    file.stream.once('error', sourceError);
    const discard = result => {
      if (!result?.public_id) return;
      this.client.uploader.destroy(result.public_id, { invalidate: true, ...(result.resource_type ? { resource_type: result.resource_type } : {}) }, () => {});
    };
    const upload = async () => {
      options = typeof this.params === 'function' ? await this.params(req, file) : Object.fromEntries(await Promise.all(
        Object.entries(this.params).map(async ([key, value]) => [key, typeof value === 'function' ? await value(req, file) : value]),
      ));
      if (settled || req.aborted) { cancel(); return; }
      destination = this.client.uploader.upload_stream(options, (error, result) => {
        if (settled) { if (!error) discard(result); return; }
        if (error) { finish(new Error('The cloud media service could not upload this file.', { cause: error })); return; }
        if (!result?.public_id || !/^https:\/\//i.test(result.secure_url || '')) {
          discard(result);
          finish(new Error('The cloud media service did not confirm a secure uploaded file.'));
          return;
        }
        finish(null, { path: result.secure_url, size: result.bytes, filename: result.public_id, resourceType: result.resource_type });
      });
      if (settled) { destination.destroy(); return; }
      destination.once('error', error => finish(new Error('The cloud media stream could not complete this upload.', { cause: error })));
      file.stream.pipe(destination);
    };
    upload().catch(error => finish(error));
  }

  _removeFile(_req, file, callback) {
    const options = { invalidate: true, ...(file.resourceType ? { resource_type: file.resourceType } : {}) };
    this.client.uploader.destroy(file.filename, options, callback);
  }
}

module.exports = { CloudinaryStorage };
