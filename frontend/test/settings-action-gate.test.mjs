import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsActionGate } from '../src/utils/settingsActionGate.js';
import { confirmProfileImage } from '../src/utils/studioProfileImage.js';

test('settings saves wait for photo validation and photos cannot start during a save', async () => {
  const gate = createSettingsActionGate();
  let uploadedImage;
  class PendingImage {
    naturalWidth = 40; naturalHeight = 40;
    set src(_value) { uploadedImage = this; }
  }
  const releaseUpload = gate.begin('photo');
  assert.ok(releaseUpload);
  const ready = confirmProfileImage('/api/studio/profile-images/507f1f77bcf86cd799439022', { ImageType: PendingImage });
  assert.equal(gate.begin('save'), null, 'the old settings snapshot cannot save while the image is pending');
  uploadedImage.onload();
  await ready;
  releaseUpload();
  const releaseSave = gate.begin('save');
  assert.ok(releaseSave);
  assert.equal(gate.begin('photo'), null, 'an upload cannot change the snapshot being saved');
  releaseSave();
  assert.equal(gate.pending(), false);
});

test('leaving a photo upload cancels decoding and stale cleanup cannot unlock the next operation', async () => {
  const gate = createSettingsActionGate(), controller = new AbortController();
  let image;
  class PendingImage { set src(_value) { image = this; } }
  const releaseOld = gate.begin('photo');
  const pending = confirmProfileImage('/photo', { ImageType: PendingImage, signal: controller.signal });
  controller.abort();
  releaseOld();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
  const releaseNew = gate.begin('photo');
  assert.ok(releaseNew);
  releaseOld();
  assert.equal(gate.begin('save'), null, 'the cancelled upload’s finally block cannot clear a newer upload');
  releaseNew();
  assert.equal(gate.pending(), false);
});
