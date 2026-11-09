import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicConfig } from '../src/saas/publicConfig.js';

const openConfig = { authEnabled: true, enabled: true, oauth: { google: { enabled: false }, apple: { enabled: false } }, trialDays: 14 };

test('an explicit closed-registration response is a successful availability check', async () => {
  const closed = { ...openConfig, enabled: false };
  assert.equal(await loadPublicConfig(async (path, options) => {
    assert.equal(path, '/config');
    assert.equal(options.publicRequest, true);
    assert.ok(options.signal instanceof AbortSignal);
    return closed;
  }), closed);
});

test('a failed check can be retried without treating failure as closed registration', async () => {
  let attempts = 0;
  const request = async () => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('Service unavailable'), { status: 503 });
    return openConfig;
  };
  await assert.rejects(loadPublicConfig(request), /Service unavailable/);
  assert.equal(await loadPublicConfig(request), openConfig);
  assert.equal(attempts, 2);
});

test('a hung check is bounded and aborts its network request', async () => {
  let requestSignal;
  await assert.rejects(loadPublicConfig((_path, { signal }) => {
    requestSignal = signal;
    return new Promise(() => {});
  }, { timeoutMs: 5 }), error => error.name === 'TimeoutError' && /try again/i.test(error.message));
  assert.equal(requestSignal.aborted, true);
});

test('unmount cancellation rejects a pending check and aborts the request', async () => {
  const controller = new AbortController();
  let requestSignal;
  const pending = loadPublicConfig((_path, { signal }) => {
    requestSignal = signal;
    return new Promise(() => {});
  }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(requestSignal.aborted, true);
});

test('an already cancelled check never starts a network request', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadPublicConfig(() => { assert.fail('request should not start'); }, { signal: controller.signal }), error => error.name === 'AbortError');
});

test('malformed or inconsistent availability flags are not accepted as closed or open registration', async () => {
  for (const response of [null, [], {}, { enabled: 'true', authEnabled: true }, { enabled: true, authEnabled: false }]) {
    await assert.rejects(loadPublicConfig(async () => response), /could not be confirmed/);
  }
});
