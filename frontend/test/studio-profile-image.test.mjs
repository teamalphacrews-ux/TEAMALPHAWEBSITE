import test from 'node:test';
import assert from 'node:assert/strict';
import { isStudioProfileImagePath, resolveProfileImage, confirmProfileImage, profilePhotoRemoval } from '../src/utils/studioProfileImage.js';

const image = '/api/studio/profile-images/507f1f77bcf86cd799439022';
const scoped = '/api/studio/profile-images/607f1f77bcf86cd799439011.507f1f77bcf86cd799439022';
test('personal and workspace uploads resolve against the API, while local assets remain frontend assets', () => {
  for (const path of [image, scoped]) {
    assert.equal(isStudioProfileImagePath(path), true);
    assert.equal(resolveProfileImage(path, 'https://api.example/'), 'https://api.example' + path);
  }
  assert.equal(resolveProfileImage('/assets/logo.png', 'https://api.example'), '/assets/logo.png');
  assert.equal(resolveProfileImage('https://cdn.example/logo.png', 'https://api.example'), 'https://cdn.example/logo.png');
  for (const value of ['https://evil.example' + image, image + '?redirect=evil', image + '/secret', '/api/studio/profile-images/../settings', null, '/api/studio/profile-images/507f1f77bcf86cd799439022.invalid']) assert.equal(isStudioProfileImagePath(value), false);
});
test('an upload is only confirmed after its public image decodes, and failed loads reject', async () => {
  class ValidImage {
    naturalWidth = 20;
    naturalHeight = 20;
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
  }
  assert.equal(await confirmProfileImage(image, { ImageType: ValidImage }), image);
  class BrokenImage { set src(_value) { queueMicrotask(() => this.onerror()); } }
  await assert.rejects(confirmProfileImage(image, { ImageType: BrokenImage }), /could not be loaded/);
  class EmptyImage extends ValidImage { naturalWidth = 0; }
  await assert.rejects(confirmProfileImage(image, { ImageType: EmptyImage }), /not a readable image/);
  class UnresponsiveImage { set src(_value) {} }
  await assert.rejects(confirmProfileImage(image, { ImageType: UnresponsiveImage, timeoutMs: 1 }), /could not be loaded/);
});
test('removing a profile photo clears an identical default logo while preserving other logos and saved data', () => {
  const values = Object.freeze({ profilePhotoUrl: image, logoUrl: image });
  assert.deepEqual(profilePhotoRemoval(values), { profilePhotoUrl: '', logoUrl: '' });
  assert.equal(values.logoUrl, image);
  assert.deepEqual(profilePhotoRemoval({ profilePhotoUrl: image, logoUrl: '/assets/custom.png' }), { profilePhotoUrl: '' });
  assert.deepEqual(profilePhotoRemoval({ profilePhotoUrl: '', logoUrl: '/assets/custom.png' }), { profilePhotoUrl: '' });
});
