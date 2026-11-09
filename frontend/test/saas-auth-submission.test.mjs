import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as socialFlow from '../src/saas/socialAuthFlow.js';
import * as providerConfig from '../src/saas/publicAuthConfig.js';
import * as signupIntent from '../src/saas/signupIntent.js';

const require = createRequire(import.meta.url);
const compiled = Object.fromEntries(['SocialAuth', 'AuthPages'].map(name => [name, transformSync(readFileSync(new URL('../src/saas/' + name + '.jsx', import.meta.url), 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code]));
const ready = { authEnabled: true, enabled: true, oauth: { google: { enabled: true }, apple: { enabled: true } } };
const component = name => Object.defineProperty(() => null, 'name', { value: name });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}
function harness({ config = ready, request = async () => { throw new Error('unavailable'); } } = {}) {
  const requests = [], storage = new Map(), navigations = [], listeners = new Map(), cleanups = [];
  const hooks = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => ({ current: initial }), useCallback: callback => callback, useId: () => 'test-id', useEffect: callback => { cleanups.push(callback()); } };
  const window = { setTimeout: () => 1, clearTimeout() {}, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), location: { assign: value => navigations.push(value) } };
  const mocks = {
    react: hooks, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-router-dom': { Link: component('Link'), Navigate: component('Navigate'), useParams: () => ({}) },
    'lucide-react': Object.fromEntries(['ArrowRight', 'LoaderCircle', 'LockKeyhole', 'ShieldCheck'].map(name => [name, component(name)])),
    '../context/AuthContext': { useAuth: () => ({}) },
    './AuthFrame': { SignupFrame: component('SignupFrame'), PasswordField: component('PasswordField') },
    './api': { saasRequest: (path, options) => { requests.push({ path, ...options }); return request(path, options); }, isWorkspaceSession: value => Boolean(value?.token && value?.user?.workspace), openWorkspaceSession: async () => {}, roleLabel() {}, safeDate() {} },
    './socialAuthFlow': socialFlow, './publicAuthConfig': providerConfig, './signupIntent': signupIntent,
    './usePublicConfig': { usePublicConfig: () => ({ config, loading: false, error: '', retry() {} }) },
    './PublicConfigStatus': { default: component('PublicConfigStatus') }, './useSignupPlan': { useSignupPlan: () => 'scale' }, './release': { IS_COMMERCIAL_DEPLOYMENT: true }, './saas.css': {},
  };
  const load = name => {
    const module = { exports: {} };
    runInNewContext(compiled[name], { module, exports: module.exports, require: name => { assert.ok(Object.hasOwn(mocks, name), 'unexpected import: ' + name); return mocks[name]; }, window, sessionStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, AbortController, URL, URLSearchParams });
    return module.exports;
  };
  const social = load('SocialAuth'); mocks['./SocialAuth'] = social;
  return { ...social, ...load('AuthPages'), requests, storage, navigations, listeners, cleanup: () => cleanups.forEach(cleanup => cleanup?.()) };
}
const submitEvent = () => ({ preventDefault() {} });

for (const name of ['SignupPage', 'ProductLoginPage']) {
  test(name + ' shares a synchronous lock between email and provider submissions', async () => {
    let rejectRequest;
    const h = harness({ request: () => new Promise((_resolve, reject) => { rejectRequest = reject; }) });
    let tree = h[name]();
    let provider = find(tree, node => node.type === h.SocialAuthButtons);
    let form = find(tree, node => node.type === 'form');
    assert.equal(provider.props.plan, 'scale');
    assert.equal(provider.props.onStart(), true);
    assert.equal(provider.props.onStart(), false);
    await form.props.onSubmit(submitEvent());
    assert.equal(h.requests.length, 0, 'provider submission blocks email before React rerenders');
    provider.props.onFinish();
    const first = form.props.onSubmit(submitEvent());
    await form.props.onSubmit(submitEvent());
    assert.equal(provider.props.onStart(), false, 'email submission blocks provider before React rerenders');
    assert.equal(h.requests.length, 1, 'repeated email submission cannot race');
    rejectRequest(new Error('offline')); await first;
    assert.equal(provider.props.onStart(), true, 'a failed request releases the shared lock');
    provider.props.onFinish(); h.cleanup();
  });
}

test('registration and provider handlers fail closed when auth is unavailable', async () => {
  const h = harness({ config: { ...ready, authEnabled: false } });
  const signup = h.SignupPage();
  assert.equal(find(signup, node => node.type === 'form'), undefined);
  const login = h.ProductLoginPage();
  await find(login, node => node.type === 'form').props.onSubmit(submitEvent());
  for (const purpose of ['signup', 'login']) {
    const buttons = h.SocialAuthButtons({ config: { ...ready, authEnabled: false }, purpose });
    await find(buttons, node => node.type === 'button').props.onClick();
  }
  assert.equal(h.requests.length, 0); h.cleanup();
});

test('provider start retains allowlisted plan and provider locally and submits only purpose', async () => {
  let resolveRequest;
  const h = harness({ request: () => new Promise(resolve => { resolveRequest = resolve; }) });
  const buttons = h.SocialAuthButtons({ config: ready, plan: 'scale', purpose: 'signup' });
  const google = find(buttons, node => node.type === 'button');
  const first = google.props.onClick(); await google.props.onClick();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0].body)), { purpose: 'signup' });
  assert.ok(h.requests[0].signal instanceof AbortSignal);
  resolveRequest({ browserProof: 'a'.repeat(64), authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=example' });
  await first;
  const saved = socialFlow.readSocialFlow(h.storage.get(socialFlow.SOCIAL_FLOW_KEY));
  assert.equal(saved.plan, 'scale'); assert.equal(saved.provider, 'google');
  assert.equal(h.navigations.length, 1);
  h.listeners.get('pageshow')({ persisted: true });
  assert.equal(h.storage.size, 0, 'returning from a provider clears stale browser proof'); h.cleanup();
});

test('provider start aborts its pending request when the component unmounts', async () => {
  const h = harness({ request: (_path, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })))) });
  const buttons = h.SocialAuthButtons({ config: ready });
  const pending = find(buttons, node => node.type === 'button').props.onClick();
  h.cleanup(); await pending;
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.navigations.length, 0); assert.equal(h.storage.size, 0);
});
