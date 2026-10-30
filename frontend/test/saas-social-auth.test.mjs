import test from 'node:test';
import assert from 'node:assert/strict';
import { readSocialFlow, callbackParameters, safeAuthorizationUrl, validSocialCode } from '../src/saas/socialAuthFlow.js';

const code = 'a'.repeat(64);
test('social browser proof is bounded, same-tab data with an expiry', () => {
  const flow = { browserProof: code, purpose: 'signup', createdAt: 1000, ticket: 'b'.repeat(64), extra: 'discard' };
  assert.deepEqual(readSocialFlow(JSON.stringify(flow), 1500), { browserProof: code, purpose: 'signup', createdAt: 1000, ticket: 'b'.repeat(64) });
  assert.equal(readSocialFlow(JSON.stringify(flow), 1000 + 16 * 60 * 1000), null);
  assert.equal(readSocialFlow(JSON.stringify(flow), 999), null);
  assert.equal(readSocialFlow('{', 1500), null);
});
test('malformed proof, purpose, and token are rejected', () => {
  for (const browserProof of [null, '', 'a'.repeat(63), 'A'.repeat(64), code + '/']) assert.equal(validSocialCode(browserProof), false);
  assert.equal(readSocialFlow(JSON.stringify({ browserProof: code, purpose: 'admin', createdAt: 1000 }), 1500), null);
  assert.deepEqual(callbackParameters('#ticket=bad'), {});
});
test('authorization navigation only permits exact provider HTTPS endpoints', () => {
  assert.equal(safeAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth?state=123', 'google'), 'https://accounts.google.com/o/oauth2/v2/auth?state=123');
  assert.equal(safeAuthorizationUrl('https://appleid.apple.com/auth/authorize?client_id=example', 'apple'), 'https://appleid.apple.com/auth/authorize?client_id=example');
  for (const value of ['javascript:alert(1)', '//evil.test', 'http://accounts.google.com/o/oauth2/v2/auth', 'https://accounts.google.com.evil.test/o/oauth2/v2/auth', 'https://accounts.google.com@evil.test/o/oauth2/v2/auth', 'https://accounts.google.com/redirect', 'https://accounts.google.com:444/o/oauth2/v2/auth', 'https://accounts.google.com/o/oauth2/v2/auth#test']) {
    assert.equal(safeAuthorizationUrl(value, 'google'), null, value);
  }
  assert.equal(safeAuthorizationUrl('https://appleid.apple.com/auth/authorize', 'google'), null);
});
test('callback errors never reflect arbitrary content and take precedence over ticket', () => {
  assert.deepEqual(callbackParameters('#ticket=' + code), { ticket: code });
  assert.match(callbackParameters('#error=cancelled&ticket=' + code).error, /cancelled/);
  assert.equal(callbackParameters('#error=' + encodeURIComponent('<script>bad</script>')).error, callbackParameters('#error=verification_failed').error);
});
