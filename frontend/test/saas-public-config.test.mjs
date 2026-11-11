import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicConfigResource, loadPublicConfig } from '../src/saas/publicConfig.js';

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

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('a response after the observed 33-second startup resolves without a false timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const reply = deferred();
  let requestSignal;
  const pending = loadPublicConfig((_path, { signal }) => { requestSignal = signal; return reply.promise; });
  t.mock.timers.tick(33000);
  assert.equal(requestSignal.aborted, false);
  reply.resolve(openConfig);
  assert.equal(await pending, openConfig);
});

test('intent warmup and simultaneous account checks share one anonymous request', async () => {
  const pending = deferred();
  let calls = 0;
  const resource = createPublicConfigResource((path, options) => {
    calls++;
    assert.equal(path, '/config');
    assert.equal(options.publicRequest, true);
    assert.deepEqual(Object.keys(options).sort(), ['publicRequest', 'signal']);
    return pending.promise;
  });
  const warmup = resource.prefetch();
  const first = resource.load(), second = resource.load();
  assert.equal(calls, 1);
  pending.resolve(openConfig);
  assert.deepEqual(await Promise.all([warmup, first, second]), [undefined, openConfig, openConfig]);
});

test('a cancelled page does not abort a request still needed by another page', async () => {
  const pending = deferred(), controller = new AbortController();
  let requestSignal;
  const resource = createPublicConfigResource((_path, { signal }) => { requestSignal = signal; return pending.promise; });
  const first = resource.load({ signal: controller.signal }), second = resource.load();
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, false);
  pending.resolve(openConfig);
  assert.equal(await second, openConfig);
});

test('the last cancelled reader aborts the request and a new mount starts cleanly', async () => {
  const firstReply = deferred(), secondReply = deferred();
  const controller = new AbortController(), requestSignals = [];
  const resource = createPublicConfigResource((_path, { signal }) => {
    requestSignals.push(signal);
    return requestSignals.length === 1 ? firstReply.promise : secondReply.promise;
  });
  const first = resource.load({ signal: controller.signal });
  controller.abort();
  const second = resource.load();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(requestSignals[0].aborted, true);
  assert.equal(requestSignals.length, 2);
  secondReply.resolve(openConfig);
  assert.equal(await second, openConfig);
  firstReply.resolve({ ...openConfig, enabled: false });
  assert.equal(await resource.load(), openConfig, 'an obsolete request cannot overwrite the newer flags');
});

test('validated flags expire quickly and an explicit retry bypasses the cache', async () => {
  let now = 1000, calls = 0;
  const replies = [openConfig, { ...openConfig, enabled: false }, openConfig];
  const resource = createPublicConfigResource(async () => replies[calls++], { cacheMs: 20, now: () => now });
  assert.equal(await resource.load(), replies[0]);
  now = 1019;
  assert.equal(await resource.load(), replies[0]);
  assert.equal(calls, 1);
  assert.equal(await resource.load({ fresh: true }), replies[1]);
  assert.equal(calls, 2);
  now = 1039;
  assert.equal(await resource.load(), replies[2]);
  assert.equal(calls, 3);
});

test('failed speculative checks stay silent and do not poison the next account visit', async () => {
  let calls = 0;
  const resource = createPublicConfigResource(async () => {
    if (++calls === 1) throw Object.assign(new Error('Starting up'), { status: 503 });
    return openConfig;
  });
  assert.equal(await resource.prefetch(), undefined);
  assert.equal(await resource.load(), openConfig);
  assert.equal(calls, 2);
});

test('a shared hung request times out for every reader and remains retryable', async () => {
  let calls = 0, requestSignal;
  const resource = createPublicConfigResource((_path, { signal }) => {
    calls++;
    requestSignal = signal;
    return calls === 1 ? new Promise(() => {}) : Promise.resolve(openConfig);
  }, { timeoutMs: 5 });
  const first = resource.load(), second = resource.load();
  await Promise.all([
    assert.rejects(first, { name: 'TimeoutError' }),
    assert.rejects(second, { name: 'TimeoutError' }),
  ]);
  assert.equal(requestSignal.aborted, true);
  assert.equal(await resource.load(), openConfig);
  assert.equal(calls, 2);
});

test('an already-cancelled resource reader neither consumes cached flags nor starts a request', async () => {
  const controller = new AbortController(); controller.abort();
  const resource = createPublicConfigResource(() => assert.fail('request must not start'));
  await assert.rejects(resource.load({ signal: controller.signal }), { name: 'AbortError' });
});
