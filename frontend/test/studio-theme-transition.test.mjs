import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelStudioThemeTransition, themeRevealGeometry, transitionStudioTheme } from '../src/utils/studioThemeTransition.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
const style = initial => {
  const properties = new Map(Object.entries(initial || {}));
  return {
    translate: 'none', transform: 'none', cssText: '',
    setProperty: (name, value) => properties.set(name, String(value)),
    getPropertyValue: name => properties.get(name) || '',
    removeProperty: name => { const old = properties.get(name); properties.delete(name); return old || ''; },
  };
};
function browser({ osReduced = false, hidden = false, width = 1280, height = 720 } = {}) {
  const classes = new Set(), timers = new Map(), animations = [], candidates = [], bodyChildren = [];
  const winListeners = new Map(), docListeners = new Map(), mediaListeners = new Set();
  let timerId = 0;
  const listen = (map, name, callback) => { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(callback); };
  const unlisten = (map, name, callback) => map.get(name)?.delete(callback);
  const rect = (left = 0, top = 0, nodeWidth = 80, nodeHeight = 44) => ({ x: left, y: top, left, top, width: nodeWidth, height: nodeHeight, right: left + nodeWidth, bottom: top + nodeHeight });
  const root = { classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) }, style: style(), getBoundingClientRect: () => rect(0, 0, width, height) };
  const media = { matches: osReduced, addEventListener: (name, callback) => { if (name === 'change') mediaListeners.add(callback); }, removeEventListener: (name, callback) => { if (name === 'change') mediaListeners.delete(callback); } };
  const win = {
    innerWidth: width, innerHeight: height, matchMedia: () => media,
    getComputedStyle: element => ({ translate: element.style.translate, transform: element.style.transform }),
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id),
    addEventListener: (name, callback) => listen(winListeners, name, callback), removeEventListener: (name, callback) => unlisten(winListeners, name, callback),
  };
  const createNode = () => ({
    style: style(), children: [], attributes: new Map(), className: '', removed: false,
    setAttribute(name, value) { this.attributes.set(name, value); },
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
    remove() { this.removed = true; const index = bodyChildren.indexOf(this); if (index >= 0) bodyChildren.splice(index, 1); },
  });
  const doc = {
    documentElement: root, hidden, visibilityState: hidden ? 'hidden' : 'visible', defaultView: win,
    querySelectorAll: () => candidates, createElement: createNode,
    body: { appendChild: element => { bodyChildren.push(element); return element; } },
    addEventListener: (name, callback) => listen(docListeners, name, callback), removeEventListener: (name, callback) => unlisten(docListeners, name, callback),
  };
  const target = ({ left = 0, top = 0, width: nodeWidth = 80, height: nodeHeight = 44, parent = null, hidden: nodeHidden = false, inert = false, animate = true, translate = 'none', transform = 'none', delay = '' } = {}) => {
    const element = {
      style: style(delay ? { '--studio-theme-delay': delay } : {}), parentElement: parent, hidden: nodeHidden, inert,
      getBoundingClientRect: () => rect(left, top, nodeWidth, nodeHeight),
      closest() { for (let current = this; current; current = current.parentElement) if (current.hidden || current.inert) return current; return null; },
    };
    element.style.translate = translate; element.style.transform = transform;
    if (animate) element.animate = (keyframes, options) => {
      const finished = deferred();
      const animation = { element, keyframes, options, finished: finished.promise, cancelled: false, finish: () => finished.resolve(), cancel: () => { animation.cancelled = true; finished.reject(new Error('Animation cancelled')); } };
      animations.push(animation); return animation;
    };
    candidates.push(element); return element;
  };
  return {
    doc, win, root, classes, timers, animations, candidates, bodyChildren, target, mediaListeners, winListeners, docListeners,
    runTimers: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ callback }) => callback()); await settle(); },
    reduceMotion: () => { media.matches = true; [...mediaListeners].forEach(callback => callback({ matches: true })); },
    resize: () => [...(winListeners.get('resize') || [])].forEach(callback => callback()),
    hide: () => { doc.hidden = true; doc.visibilityState = 'hidden'; [...(docListeners.get('visibilitychange') || [])].forEach(callback => callback()); },
  };
}

test('the circular reveal reaches every viewport corner from pointer, keyboard button and fallback origins', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 2560, height: 1080 }]) {
    const { width, height } = viewport;
    const origins = [undefined, { x: 0, y: 0 }, { x: width - 15, y: 30 }, { x: -200, y: height + 500 }, { getBoundingClientRect: () => ({ left: width - 100, top: 20, width: 44, height: 44 }) }];
    for (const origin of origins) {
      const geometry = themeRevealGeometry(origin, viewport);
      assert.ok(geometry.x >= 0 && geometry.x <= width);
      assert.ok(geometry.y >= 0 && geometry.y <= height);
      for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height]]) assert.ok(geometry.radius >= Math.hypot(x - geometry.x, y - geometry.y));
    }
    const keyboardOrigin = themeRevealGeometry(origins.at(-1), viewport);
    assert.equal(keyboardOrigin.x, width - 78);
    assert.equal(keyboardOrigin.y, 42);
  }
  const invalid = themeRevealGeometry({ x: NaN, y: Infinity }, { width: 0, height: NaN });
  assert.ok([invalid.x, invalid.y, invalid.radius].every(Number.isFinite));
});

test('live elements float in a distance-staggered wave while the theme commits immediately', async () => {
  const env = browser(); let commits = 0;
  const near = env.target({ left: 80, top: 80, width: 40, height: 40 });
  const middle = env.target({ left: 480, top: 280 });
  const far = env.target({ left: 1100, top: 620 });
  const completion = transitionStudioTheme({ commit: () => commits++, origin: { x: 100, y: 100 }, doc: env.doc, win: env.win });
  assert.equal(commits, 1);
  assert.deepEqual(env.animations.map(animation => animation.element), [near, middle, far]);
  const delays = env.animations.map(animation => animation.options.delay);
  assert.equal(delays[0], 0);
  assert.ok(delays[1] > delays[0]);
  assert.ok(delays[2] > delays[1] && delays[2] <= 180);
  assert.equal(env.classes.has('studio-theme-fade'), true);
  assert.equal(env.bodyChildren.length, 1);
  assert.equal(env.bodyChildren[0].attributes.get('aria-hidden'), 'true');
  for (const animation of env.animations) assert.ok(animation.keyframes[1].translate.includes(' - 9px)'));
  await env.runTimers(); await completion;
  assert.equal(commits, 1);
  assert.equal(env.classes.size, 0);
  assert.equal(env.bodyChildren.length, 0);
});

test('the wave restores each original translate and delay without replacing its transform or opacity', async () => {
  const env = browser();
  const element = env.target({ translate: '3px 4px', transform: 'rotate(8deg) scale(1.1)', delay: '24ms' });
  const completion = transitionStudioTheme({ commit() {}, doc: env.doc, win: env.win });
  const animation = env.animations[0];
  assert.equal(animation.keyframes[0].translate, '3px 4px');
  assert.equal(animation.keyframes.at(-1).translate, '3px 4px');
  assert.notEqual(element.style.getPropertyValue('--studio-theme-delay'), '24ms');
  assert.ok(animation.keyframes.every(frame => !Object.hasOwn(frame, 'transform') && !Object.hasOwn(frame, 'opacity')));
  assert.equal(element.style.transform, 'rotate(8deg) scale(1.1)');
  await env.runTimers(); await completion;
  assert.equal(element.style.translate, '3px 4px');
  assert.equal(element.style.transform, 'rotate(8deg) scale(1.1)');
  assert.equal(element.style.getPropertyValue('--studio-theme-delay'), '24ms');
  assert.equal(animation.cancelled, true);
});

test('nested content moves with its selected parent; offscreen, hidden, inert and empty targets are excluded', async () => {
  const env = browser();
  const card = env.target({ left: 100, top: 100, width: 300, height: 280 });
  env.target({ parent: card, left: 120, top: 120 });
  env.target({ top: 800 });
  env.target({ left: -200 });
  env.target({ hidden: true });
  const inertParent = { inert: true, parentElement: null };
  env.target({ parent: inertParent });
  env.target({ width: 0 });
  const visibleLabel = env.target({ left: 500, top: 120 });
  const completion = transitionStudioTheme({ commit() {}, doc: env.doc, win: env.win });
  assert.deepEqual(env.animations.map(animation => animation.element), [card, visibleLabel]);
  assert.equal(card.style.getPropertyValue('--studio-theme-delay').endsWith('ms'), true);
  for (const element of env.candidates.filter(element => element !== card && element !== visibleLabel)) assert.equal(element.style.getPropertyValue('--studio-theme-delay'), '');
  await env.runTimers(); await completion;
});

test('rapid switching cancels the previous live wave and catches rejected animations without erasing the next wave', async () => {
  const env = browser(); const commits = [];
  const element = env.target({ delay: '17ms' });
  const first = transitionStudioTheme({ commit: () => commits.push('dark'), doc: env.doc, win: env.win });
  const firstRipple = env.bodyChildren[0], firstAnimation = env.animations[0];
  const second = transitionStudioTheme({ commit: () => commits.push('light'), origin: { x: 0, y: 0 }, doc: env.doc, win: env.win });
  await first; await settle();
  assert.deepEqual(commits, ['dark', 'light']);
  assert.equal(firstAnimation.cancelled, true);
  assert.equal(firstRipple.removed, true);
  assert.equal(env.bodyChildren.length, 1);
  assert.notEqual(env.bodyChildren[0], firstRipple);
  assert.equal(env.classes.has('studio-theme-fade'), true);
  assert.equal(env.animations[1].cancelled, false);
  assert.notEqual(element.style.getPropertyValue('--studio-theme-delay'), '17ms');
  await env.runTimers(); await second;
  assert.equal(element.style.getPropertyValue('--studio-theme-delay'), '17ms');
  assert.equal(env.animations[1].cancelled, true);
  assert.equal(env.classes.size, 0);
  assert.equal(env.timers.size, 0);
});

test('personal reduced motion, device reduced motion and hidden tabs commit once without any wave or ripple', async () => {
  for (const options of [{ reduceMotion: true }, { osReduced: true }, { hidden: true }]) {
    const env = browser(options); let commits = 0;
    env.target();
    await transitionStudioTheme({ commit: () => commits++, reduceMotion: options.reduceMotion, doc: env.doc, win: env.win });
    assert.equal(commits, 1);
    assert.equal(env.animations.length, 0);
    assert.equal(env.bodyChildren.length, 0);
    assert.equal(env.classes.size, 0);
    assert.equal(env.timers.size, 0);
  }
});

test('older browsers without element animations still apply the theme with the short color fade and ripple', async () => {
  const env = browser({ width: 390, height: 844 }); let commits = 0;
  const element = env.target({ animate: false });
  const completion = transitionStudioTheme({ commit: () => commits++, doc: env.doc, win: env.win });
  assert.equal(commits, 1);
  assert.equal(env.animations.length, 0);
  assert.equal(env.classes.has('studio-theme-fade'), true);
  assert.equal(env.bodyChildren.length, 1);
  assert.ok(element.style.getPropertyValue('--studio-theme-delay'));
  await env.runTimers(); await completion;
  assert.equal(commits, 1);
  assert.equal(env.bodyChildren.length, 0);
  assert.equal(env.classes.size, 0);
  assert.equal(element.style.getPropertyValue('--studio-theme-delay'), '');
});

test('unmount cleanup releases live animations, their CSS delays, the ripple and listeners', async () => {
  const env = browser(); let commits = 0;
  const element = env.target();
  const completion = transitionStudioTheme({ commit: () => commits++, doc: env.doc, win: env.win });
  const ripple = env.bodyChildren[0];
  cancelStudioThemeTransition(env.doc); await completion; await settle();
  assert.equal(commits, 1);
  assert.equal(env.animations[0].cancelled, true);
  assert.equal(element.style.getPropertyValue('--studio-theme-delay'), '');
  assert.equal(ripple.removed, true);
  assert.equal(env.bodyChildren.length, 0);
  assert.equal(env.classes.size, 0);
  assert.equal(env.timers.size, 0);
  assert.equal(env.mediaListeners.size, 0);
  assert.equal(env.winListeners.get('resize').size, 0);
  assert.equal(env.docListeners.get('visibilitychange').size, 0);
});

test('device motion changes, tab hiding and resizing stop an active wave without a second theme commit', async () => {
  for (const interrupt of ['reduceMotion', 'hide', 'resize']) {
    const env = browser(); let commits = 0;
    env.target({ delay: '11ms' });
    const completion = transitionStudioTheme({ commit: () => commits++, doc: env.doc, win: env.win });
    env[interrupt](); await completion; await settle();
    assert.equal(commits, 1);
    assert.equal(env.animations[0].cancelled, true);
    assert.equal(env.candidates[0].style.getPropertyValue('--studio-theme-delay'), '11ms');
    assert.equal(env.bodyChildren.length, 0);
    assert.equal(env.classes.size, 0);
    assert.equal(env.timers.size, 0);
  }
});

test('a rejected animation API cannot block the theme change or fallback cleanup', async () => {
  const env = browser(); let commits = 0;
  const element = env.target(); element.animate = () => { throw new Error('Unsupported animation property'); };
  const completion = transitionStudioTheme({ commit: () => commits++, doc: env.doc, win: env.win });
  assert.equal(commits, 1);
  assert.equal(env.classes.has('studio-theme-fade'), true);
  assert.equal(env.bodyChildren.length, 1);
  await env.runTimers(); await completion;
  assert.equal(commits, 1);
  assert.equal(env.classes.size, 0);
  assert.equal(env.bodyChildren.length, 0);
});

