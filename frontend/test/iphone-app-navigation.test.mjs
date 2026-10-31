import test from 'node:test';
import assert from 'node:assert/strict';
import { usesIPhoneAppNavigation } from '../src/native/appNavigation.js';

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ipad = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ipadDesktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15';

test('installed iPhone app uses More navigation in either orientation', () => {
  assert.equal(usesIPhoneAppNavigation({ nativeAvailable: true, userAgent: iphone }), true);
});
test('iPhone Safari can opt into More while keeping the helper default explicit', () => {
  assert.equal(usesIPhoneAppNavigation({ userAgent: iphone }), false);
  assert.equal(usesIPhoneAppNavigation({ userAgent: iphone, allowMobileWeb: true }), true);
  for (const userAgent of [ipad, ipadDesktop]) assert.equal(usesIPhoneAppNavigation({ userAgent, allowMobileWeb: true }), false);
});
test('native iPad and desktop-mode iPad keep the original sidebar', () => {
  for (const userAgent of [ipad, ipadDesktop]) assert.equal(usesIPhoneAppNavigation({ nativeAvailable: true, userAgent }), false);
});
test('a normal desktop browser never opts into the app menu', () => {
  assert.equal(usesIPhoneAppNavigation({ userAgent: ipadDesktop }), false);
});
test('isolated preview requires explicit iPhone device and development permission', () => {
  assert.equal(usesIPhoneAppNavigation({ previewDevice: 'iphone' }), false);
  assert.equal(usesIPhoneAppNavigation({ allowPreview: true }), false);
  assert.equal(usesIPhoneAppNavigation({ allowPreview: true, previewDevice: 'iphone' }), true);
  for (const previewDevice of ['ipad', 'desktop', 'unknown']) assert.equal(usesIPhoneAppNavigation({ allowPreview: true, previewDevice }), false);
});
test('native iPad identity takes precedence over preview selection', () => {
  assert.equal(usesIPhoneAppNavigation({ nativeAvailable: true, userAgent: ipad, allowPreview: true, previewDevice: 'iphone' }), false);
});
