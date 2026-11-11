import test from 'node:test';
import assert from 'node:assert/strict';
import { readSignupPlan, retainSignupPlan, signupHref, signupPlanId, SIGNUP_PLAN_KEY } from '../src/saas/signupIntent.js';
import { readSocialFlow, socialCallbackState } from '../src/saas/socialAuthFlow.js';

test('each advertised plan reaches signup and survives a same-tab reload', () => {
  const storage = new Map();
  for (const plan of ['starter', 'studio', 'scale']) {
    assert.equal(signupHref(plan), '/signup?plan=' + plan);
    assert.equal(readSignupPlan('?plan=' + plan), plan);
    retainSignupPlan({ setItem: (key, value) => storage.set(key, value) }, plan, 1000);
    assert.equal(readSignupPlan('', storage.get(SIGNUP_PLAN_KEY), 1500), plan);
  }
});

test('an explicit new choice wins over the stored plan; invalid URL choices cannot revive it', () => {
  const saved = JSON.stringify({ plan: 'scale', createdAt: 1000 });
  assert.equal(readSignupPlan('?provider=google&plan=studio', saved, 1500), 'studio');
  assert.equal(readSignupPlan('?plan=enterprise', saved, 1500), 'starter');
  for (const value of ['__proto__', 'constructor', '<script>', 'Studio', null]) assert.equal(signupPlanId(value), null);
});

test('expired, future or invalid stored intent falls back to Starter', () => {
  for (const value of ['{', null, JSON.stringify({ plan: 'scale', createdAt: 2000 }), JSON.stringify({ plan: 'scale', createdAt: -86400000 }), JSON.stringify({ plan: 'enterprise', createdAt: 1000 })]) {
    assert.equal(readSignupPlan('', value, 1500), 'starter');
  }
});

test('blocked storage does not block signup navigation or allow unsupported plans', () => {
  const storage = { setItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => retainSignupPlan(storage, 'studio'));
  assert.equal(signupHref('unknown'), '/signup?plan=starter');
});

test('social authentication retains only a valid plan preference alongside proof', () => {
  const flow = { browserProof: 'a'.repeat(64), purpose: 'signup', createdAt: 1000, ticket: 'b'.repeat(64), plan: 'studio' };
  assert.equal(readSocialFlow(JSON.stringify(flow), 1500).plan, 'studio');
  assert.equal(readSocialFlow(JSON.stringify({ ...flow, plan: 'enterprise' }), 1500).plan, undefined);
  assert.equal(readSocialFlow(JSON.stringify(flow), 1000 + 16 * 60 * 1000), null);
});

test('provider cancellation preserves validated signup and plan context for restarting', () => {
  const raw = JSON.stringify({ browserProof: 'a'.repeat(64), purpose: 'signup', plan: 'scale', createdAt: 1000 });
  const cancelled = socialCallbackState(raw, '#error=cancelled', 1500);
  assert.equal(cancelled.purpose, 'signup');
  assert.equal(cancelled.plan, 'scale');
  assert.match(cancelled.error, /cancelled/);
  assert.equal(cancelled.browserProof, undefined);
  assert.equal(signupHref(cancelled.plan), '/signup?plan=scale');
  assert.equal(socialCallbackState(raw, '#error=expired', 1000 + 16 * 60000).plan, undefined);
});

test('callback ticket errors retain valid intent while refusing to authenticate', () => {
  const raw = JSON.stringify({ browserProof: 'a'.repeat(64), purpose: 'signup', plan: 'studio', createdAt: 1000 });
  const missing = socialCallbackState(raw, '#ticket=invalid', 1500);
  assert.equal(missing.plan, 'studio');
  assert.equal(missing.purpose, 'signup');
  assert.ok(missing.error);
  assert.equal(missing.ticket, undefined);
  const valid = socialCallbackState(raw, '#ticket=' + 'b'.repeat(64), 1500);
  assert.equal(valid.plan, 'studio');
  assert.equal(valid.ticket, 'b'.repeat(64));
});

test('provider, plan and ticket coexist without retaining arbitrary account metadata', () => {
  const flow = { browserProof: 'a'.repeat(64), purpose: 'signup', provider: 'apple', plan: 'scale', ticket: 'b'.repeat(64), createdAt: 1000 };
  assert.deepEqual(readSocialFlow(JSON.stringify({ ...flow, email: 'untrusted@example.com', role: 'owner', workspaceId: 'other' }), 1500), flow);
  const invalidContext = readSocialFlow(JSON.stringify({ ...flow, provider: '<script>', plan: 'enterprise' }), 1500);
  assert.equal(invalidContext.provider, undefined);
  assert.equal(invalidContext.plan, undefined);
  assert.equal(invalidContext.ticket, flow.ticket);
});

test('a valid callback ticket cannot extend the backend ten-minute flow lifetime', () => {
  const flow = { browserProof: 'a'.repeat(64), purpose: 'signup', provider: 'google', plan: 'studio', ticket: 'b'.repeat(64), createdAt: 1000 };
  const raw = JSON.stringify(flow), fragment = '#ticket=' + 'c'.repeat(64);
  assert.equal(socialCallbackState(raw, fragment, 1000 + 10 * 60000 - 1).provider, 'google');
  for (const now of [999, 1000 + 10 * 60000, 1000 + 12 * 60000]) {
    assert.equal(readSocialFlow(raw, now), null);
    const rejected = socialCallbackState(raw, fragment, now);
    assert.ok(rejected.error);
    for (const key of ['plan', 'provider', 'ticket', 'browserProof']) assert.equal(rejected[key], undefined);
  }
});

test('provider errors preserve restart intent without disclosing provider proof or a retained ticket', () => {
  const raw = JSON.stringify({ browserProof: 'a'.repeat(64), purpose: 'signup', provider: 'apple', plan: 'scale', ticket: 'b'.repeat(64), createdAt: 1000 });
  const result = socialCallbackState(raw, '#error=cancelled&ticket=' + 'c'.repeat(64), 1500);
  assert.deepEqual(Object.keys(result).sort(), ['error', 'plan', 'purpose']);
  assert.equal(result.plan, 'scale');
  assert.match(result.error, /cancelled/);
});
