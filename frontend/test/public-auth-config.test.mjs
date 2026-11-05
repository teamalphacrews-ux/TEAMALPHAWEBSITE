import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicAuthConfig, socialProviderState } from '../src/saas/publicAuthConfig.js';
import { readSocialFlow, validateWorkspaceDetails } from '../src/saas/socialAuthFlow.js';

const config = { authEnabled: true, enabled: true, oauth: { google: { enabled: true }, apple: { enabled: true } } };
test('signup and login respect independent registration and provider gates', () => {
  for (const provider of ['google', 'apple']) {
    assert.equal(socialProviderState(config, provider, 'signup'), 'ready');
    assert.equal(socialProviderState({ ...config, enabled: false }, provider, 'signup'), 'closed');
    assert.equal(socialProviderState({ ...config, enabled: false }, provider, 'login'), 'ready');
    assert.equal(socialProviderState({ ...config, authEnabled: false }, provider, 'login'), 'unavailable');
    assert.equal(socialProviderState({ ...config, oauth: { [provider]: { enabled: false } } }, provider, 'signup'), 'unavailable');
    assert.equal(socialProviderState(null, provider, 'signup'), 'unknown');
    assert.equal(socialProviderState(config, provider, 'signup', true), 'checking');
    assert.equal(socialProviderState({ ...config, oauth: { [provider]: { enabled: 'true' } } }, provider, 'signup'), 'unavailable');
  }
});

test('readiness only requests public configuration, and malformed responses never enable signup', async () => {
  const result = await loadPublicAuthConfig(async (path, options) => {
    assert.equal(path, '/config'); assert.equal(options.publicRequest, true);
    assert.ok(options.signal instanceof AbortSignal);
    return config;
  });
  assert.equal(result, config);
  for (const invalid of [null, {}, { enabled: true }, { ...config, enabled: 'true' }, { ...config, oauth: null }]) {
    await assert.rejects(loadPublicAuthConfig(async () => invalid), /could not be confirmed/);
  }
});

test('a slow readiness request aborts and offers a useful retry message', async () => {
  await assert.rejects(loadPublicAuthConfig((_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }), { timeoutMs: 8 }), /taking longer than expected/);
});

test('unmount cancellation stays silent and a later retry can recover', async () => {
  const controller = new AbortController();
  const pending = loadPublicAuthConfig((_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(await loadPublicAuthConfig(async () => config), config);
});

test('social workspace setup trims values, supports missing Apple surname and flags empty names', () => {
  assert.deepEqual(validateWorkspaceDetails({ studioName: '  Frame Studio  ', firstName: '  Riya ', lastName: '' }), {
    values: { studioName: 'Frame Studio', firstName: 'Riya', lastName: '' }, errors: {},
  });
  const { errors } = validateWorkspaceDetails({ studioName: '  ', firstName: '  ', lastName: 'a'.repeat(121) });
  assert.deepEqual(Object.keys(errors).sort(), ['firstName', 'lastName', 'studioName']);
  assert.match(validateWorkspaceDetails({ studioName: 'Frame\nStudio', firstName: 'Ri\tya' }).errors.studioName, /single line/);
});

test('provider context is optional and allowlisted, with the backend ten-minute ticket lifetime', () => {
  const flow = { browserProof: 'a'.repeat(64), purpose: 'signup', provider: 'apple', createdAt: 1000 };
  assert.equal(readSocialFlow(JSON.stringify(flow), 1000 + 9 * 60 * 1000).provider, 'apple');
  assert.equal(readSocialFlow(JSON.stringify(flow), 1000 + 10 * 60 * 1000 + 1), null);
  assert.equal(readSocialFlow(JSON.stringify({ ...flow, provider: '<script>' }), 1000).provider, undefined);
});
