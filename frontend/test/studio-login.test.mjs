import test from 'node:test';
import assert from 'node:assert/strict';
import { requestStudioLogin } from '../src/utils/studioLogin.js';

const credentials = { email: ' owner@example.test ', password: 'synthetic-password' };
const account = { user: { id: 'owner', role: 'admin' }, token: 'synthetic-session' };
const response = data => ({ ok: true, json: async () => data });

test('fresh studio sign-in sends one administrator request and validates the returned session', async () => {
  let calls = 0;
  const result = await requestStudioLogin('https://api.example.test', credentials, { fetcher: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.example.test/api/auth/login');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { email: 'owner@example.test', password: credentials.password, role: 'admin' });
    assert.equal(options.signal.aborted, false);
    return response(account);
  } });
  assert.deepEqual(result, account);
  assert.equal(calls, 1);
  for (const data of [{ user: { role: 'client' }, token: 'session' }, { user: { role: 'admin' }, token: '' }]) {
    await assert.rejects(requestStudioLogin('', credentials, { fetcher: async () => response(data) }));
  }
});

test('stalled sign-in times out, aborts its request and does not retry credentials', async () => {
  let calls = 0, requestSignal;
  await assert.rejects(requestStudioLogin('', credentials, { timeoutMs: 5, fetcher: (_url, { signal }) => {
    calls++; requestSignal = signal;
    // A stuck transport may not reject on abort: the visible deadline still ends.
    return new Promise(() => {});
  } }), error => error.name === 'TimeoutError' && /try signing in again/.test(error.message));
  assert.equal(calls, 1);
  assert.equal(requestSignal.aborted, true);
});

test('the sign-in deadline also bounds a stalled response body', async () => {
  await assert.rejects(requestStudioLogin('', credentials, {
    timeoutMs: 5, fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }),
  }), { name: 'TimeoutError' });
});

test('leaving the login page cancels the request without a later successful session', async () => {
  const controller = new AbortController();
  let complete, requestSignal;
  const pending = requestStudioLogin('', credentials, { signal: controller.signal, fetcher: (_url, { signal }) => {
    requestSignal = signal;
    return new Promise(resolve => { complete = resolve; });
  } });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
  complete(response(account));
  await assert.rejects(requestStudioLogin('', credentials, { signal: controller.signal, fetcher: () => assert.fail('must not submit after cancellation') }), { name: 'AbortError' });
});
