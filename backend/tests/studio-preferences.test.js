const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePreferences, defaults, CARD_IDS } = require('../utils/studioPreferences');
test.beforeEach(require('./sessionFixture'));
test('Finance can be personalized and older saved layouts retain their migration version', () => {
  assert.deepEqual(parsePreferences({ layoutVersion: 2, visibleCards: ['financePulse'] }), { visibleCards: ['financePulse'], layoutVersion: 2 });
  assert.throws(() => parsePreferences({ layoutVersion: 99 }), error => error.status === 400);
  const User = require('../models/User');
  assert.equal(new User({ studioPreferences: { visibleCards: ['bookingMomentum'] } }).studioPreferences.layoutVersion, 1);
  assert.equal(defaults().layoutVersion, 3);
});
test('overview preferences allow an intentionally empty overview and reject unknown cards, duplicates and privilege fields', () => {
  assert.deepEqual(parsePreferences({ visibleCards: [] }), { visibleCards: [] });
  assert.equal(defaults().visibleCards.length, 13);
  for (const body of [null, [], { theme: 'midnight' }, { visibleCards: ['private-client-record'] }, { visibleCards: [CARD_IDS[0], CARD_IDS[0]] }, { role: 'admin' }, { userId: 'another-account' }, { visibleCards: '__proto__' }]) assert.throws(() => parsePreferences(body), error => error.status === 400);
  const original = defaults(); original.visibleCards.pop(); assert.equal(defaults().visibleCards.length, 13);
});
test('appearance updates are scoped to the signed-in saved account and do not change studio-wide settings', async t => {
  const jwt = require('jsonwebtoken'), User = require('../models/User');
  const id = '507f1f77bcf86cd79943fd01'; process.env.JWT_SECRET = 'preferences-test-secret';
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: id, role: 'admin', sessionVersion: 0, studioPreferences: defaults() }) }));
  let captured;
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ select: async () => { captured = { filter, update }; return { studioPreferences: { theme: 'dark', visibleCards: [] } }; } }));
  const token = jwt.sign({ user: { id, role: 'admin' } }, process.env.JWT_SECRET);
  const router = require('../routes/studioPreferencesRoutes');
  const result = await new Promise((resolve, reject) => router.handle({ method: 'PATCH', url: '/preferences', body: { theme: 'dark', visibleCards: [] }, headers: { authorization: 'Bearer ' + token }, header: name => name.toLowerCase() === 'authorization' ? 'Bearer ' + token : undefined }, { set() {}, status(status) { this.statusCode = status; return this; }, json(body) { resolve({ status: this.statusCode || 200, body }); } }, reject));
  assert.equal(result.status, 200); assert.equal(captured.filter._id, id); assert.equal(captured.filter.role, 'admin');
  assert.deepEqual(captured.update, { $set: { 'studioPreferences.theme': 'dark', 'studioPreferences.visibleCards': [] } });
  assert.deepEqual(result.body.preferences.visibleCards, []);
});
test('card order is an independent complete permutation and rejects incomplete or duplicate layouts', () => {
  const order = [...defaults().cardOrder].reverse();
  assert.deepEqual(parsePreferences({ cardOrder: order, visibleCards: [] }), { visibleCards: [], cardOrder: order });
  for (const cardOrder of [[], ['actionQueue'], [...CARD_IDS.slice(0, -1), CARD_IDS[0]], [...CARD_IDS.slice(0, -1), 'unknown']]) assert.throws(() => parsePreferences({ cardOrder }), error => error.status === 400);
  const original = defaults(); original.cardOrder.reverse(); assert.deepEqual(defaults().cardOrder.slice(0, 3), ['upcomingSchedule', 'bookingMomentum', 'productionPulse']);
});
test('older clients can save a complete twelve-card order without losing the new activity map', () => {
  const oldOrder = defaults().cardOrder.filter(id => id !== 'activityMap').reverse();
  assert.deepEqual(parsePreferences({ cardOrder: oldOrder }).cardOrder, [...oldOrder, 'activityMap']);
  assert.throws(() => parsePreferences({ cardOrder: defaults().cardOrder.filter(id => id !== 'financePulse') }), error => error.status === 400);
});
test('personal appearance, motion and start pages are validated without accepting arbitrary redirects', () => {
  const patch = { theme: 'system', reduceMotion: true, landingPage: '/admin/calendar' };
  assert.deepEqual(parsePreferences(patch), patch);
  for (const body of [{ reduceMotion: 'true' }, { reduceMotion: 1 }, { landingPage: 'https://example.com' }, { landingPage: '//example.com' }, { landingPage: '/admin/calendar?redirect=external' }, { landingPage: '/admin/users/unknown' }]) assert.throws(() => parsePreferences(body), error => error.status === 400);
  assert.equal(defaults().reduceMotion, false);
  assert.equal(defaults().landingPage, '/admin');
  const User = require('../models/User');
  const old = new User({ studioPreferences: { theme: 'dark', visibleCards: [] } });
  assert.equal(old.studioPreferences.reduceMotion, false);
  assert.equal(old.studioPreferences.landingPage, '/admin');
  assert.equal(new User({ studioPreferences: patch }).studioPreferences.validateSync(), undefined);
});

test('regional and notification preferences validate bounded values and leave partial updates partial', () => {
  const patch = { language: 'kn', region: 'IN', timezone: 'Asia/Kolkata', dateFormat: 'iso', timeFormat: '24h', numberFormat: 'international', notificationBadges: false, notificationToasts: true, notificationSound: true, notificationVolume: 65, notificationTone: 'soft', notificationCategories: [], quietHoursEnabled: true, quietHoursStart: '23:30', quietHoursEnd: '07:15' };
  assert.deepEqual(parsePreferences(patch), patch);
  assert.deepEqual(parsePreferences({ language: 'ta' }), { language: 'ta' });
  assert.deepEqual(parsePreferences({ notificationVolume: 0 }), { notificationVolume: 0 });
  assert.deepEqual(parsePreferences({ timezone: 'studio' }), { timezone: 'studio' });
  for (const invalid of [
    { language: 'xx' }, { region: 'xx' }, { timezone: 'Asia/Fake' }, { timezone: 'GMT+5:30' }, { timezone: 5 }, { timezone: 'A'.repeat(81) },
    { dateFormat: 'custom' }, { timeFormat: '25h' }, { numberFormat: 'random' }, { notificationTone: 'alarm' },
    { notificationBadges: 'true' }, { notificationToasts: 0 }, { notificationSound: null }, { quietHoursEnabled: 'false' },
    { notificationVolume: -1 }, { notificationVolume: 101 }, { notificationVolume: 1.5 }, { notificationVolume: '50' },
    { notificationCategories: ['finance', 'finance'] }, { notificationCategories: ['unknown'] }, { notificationCategories: 'finance' },
    { quietHoursStart: '24:00' }, { quietHoursEnd: '7:00' }, { quietHoursEnd: '08:60' }, { quietHoursStart: null },
  ]) assert.throws(() => parsePreferences(invalid), error => error.status === 400, JSON.stringify(invalid));
});

test('legacy User documents receive safe personal defaults and the schema persists new choices', () => {
  const User = require('../models/User');
  const legacy = new User({ studioPreferences: { theme: 'dark', visibleCards: [] } }).studioPreferences;
  assert.equal(legacy.language, 'en'); assert.equal(legacy.region, 'IN'); assert.equal(legacy.timezone, 'studio');
  assert.equal(legacy.notificationSound, false); assert.equal(legacy.notificationBadges, true); assert.equal(legacy.quietHoursEnabled, false);
  const chosen = { ...defaults(), language: 'ur', region: 'AE', timezone: 'Asia/Dubai', notificationSound: true, notificationCategories: ['finance', 'messages'], quietHoursStart: '21:00' };
  const document = new User({ studioPreferences: chosen });
  assert.equal(document.studioPreferences.validateSync(), undefined);
  assert.deepEqual(document.toObject().studioPreferences, chosen);
  for (const patch of [{ language: 'xx' }, { timezone: 'Asia/Fake' }, { notificationVolume: 0.5 }, { notificationCategories: ['unknown'] }, { quietHoursEnd: '99:00' }]) assert.ok(new User({ studioPreferences: patch }).studioPreferences.validateSync());
  const copy = defaults(); copy.notificationCategories.pop(); assert.equal(defaults().notificationCategories.length, 6);
});

test('language and sound PATCH then GET round trip is scoped to the account and preserves unrelated preferences', async t => {
  const jwt = require('jsonwebtoken'), User = require('../models/User');
  const id = '507f1f77bcf86cd79943fd02'; process.env.JWT_SECRET = 'preferences-test-secret';
  let stored = { ...defaults(), theme: 'dark', cardOrder: [...defaults().cardOrder].reverse() }, captured;
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: id, role: 'admin', sessionVersion: 0, studioPreferences: stored }) }));
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ select: async () => {
    captured = { filter, update };
    stored = { ...stored, ...Object.fromEntries(Object.entries(update.$set).map(([path, value]) => [path.replace('studioPreferences.', ''), value])) };
    return { studioPreferences: stored };
  } }));
  const token = jwt.sign({ user: { id, role: 'admin' } }, process.env.JWT_SECRET), router = require('../routes/studioPreferencesRoutes');
  const call = (method, body) => new Promise((resolve, reject) => router.handle({ method, url: '/preferences', body, headers: { authorization: 'Bearer ' + token }, header: name => name.toLowerCase() === 'authorization' ? 'Bearer ' + token : undefined }, { set() {}, status(status) { this.statusCode = status; return this; }, json(body) { resolve({ status: this.statusCode || 200, body }); } }, reject));
  const patch = { language: 'kn', region: 'IN', notificationSound: true, notificationVolume: 20, notificationCategories: ['calendar'], quietHoursEnabled: true };
  const saved = await call('PATCH', patch);
  assert.equal(saved.status, 200); assert.deepEqual(captured.filter, { _id: id, role: 'admin' });
  assert.deepEqual(captured.update.$set, Object.fromEntries(Object.entries(patch).map(([key, value]) => ['studioPreferences.' + key, value])));
  const loaded = await call('GET'); assert.equal(loaded.status, 200);
  assert.deepEqual(loaded.body.preferences, saved.body.preferences);
  assert.equal(loaded.body.preferences.theme, 'dark'); assert.deepEqual(loaded.body.preferences.cardOrder, [...defaults().cardOrder].reverse());
  assert.equal(loaded.body.preferences.language, 'kn'); assert.equal(loaded.body.preferences.notificationVolume, 20);
});
