import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LANGUAGE_OPTIONS, REGION_OPTIONS, defaultPersonalPreferences, normalizePersonalPreferences, isValidPreferenceTimezone } from '../src/utils/personalPreferences.js';
import { normalizeOverviewPreferences, defaultOverviewPreferences } from '../src/utils/overviewPreferences.js';
const backend = createRequire(import.meta.url)('../../backend/utils/studioPreferences');

test('English plus ten Indian languages and regional choices match the backend contract', () => {
  assert.equal(LANGUAGE_OPTIONS.length, 11);
  assert.deepEqual(LANGUAGE_OPTIONS.map(option => option.value), backend.LANGUAGES);
  assert.ok(LANGUAGE_OPTIONS.every(option => option.nativeName && option.label && Intl.DateTimeFormat.supportedLocalesOf(option.locale).length));
  assert.deepEqual(REGION_OPTIONS.map(option => option.value), backend.REGIONS);
  assert.deepEqual(defaultPersonalPreferences(), backend.personalDefaults());
  assert.deepEqual(defaultOverviewPreferences(), backend.defaults());
});

test('older caches add safe defaults without losing existing theme, visibility or saved order', () => {
  const old = { theme: 'dark', layoutVersion: 2, visibleCards: [], cardOrder: [...defaultOverviewPreferences().cardOrder].reverse() };
  const updated = normalizeOverviewPreferences(old);
  assert.equal(updated.theme, 'dark'); assert.deepEqual(updated.visibleCards, []); assert.deepEqual(updated.cardOrder, old.cardOrder);
  for (const [key, value] of Object.entries(defaultPersonalPreferences())) assert.deepEqual(updated[key], value);
});

test('saved language, silence and empty category choices survive JSON storage and normalization', () => {
  const chosen = { ...defaultOverviewPreferences(), language: 'kn', region: 'AE', timezone: 'Asia/Dubai', dateFormat: 'iso', timeFormat: '24h', numberFormat: 'international', notificationSound: true, notificationBadges: false, notificationVolume: 0, notificationCategories: [], quietHoursEnabled: true, quietHoursStart: '23:00', quietHoursEnd: '06:15' };
  assert.deepEqual(normalizeOverviewPreferences(JSON.parse(JSON.stringify(chosen))), chosen);
  assert.deepEqual(backend.parsePreferences(chosen), chosen);
});

test('malformed caches are normalized without arbitrary zones, strings-as-booleans or invalid times', () => {
  const malformed = { language: 'unknown', region: 'unknown', timezone: '../../etc', dateFormat: 'custom', timeFormat: '25h', numberFormat: 'custom', notificationSound: 'false', notificationBadges: 0, notificationVolume: 101, notificationTone: 'unknown', quietHoursEnabled: 'true', quietHoursStart: '25:00', quietHoursEnd: '5:00' };
  assert.deepEqual(normalizePersonalPreferences(malformed), defaultPersonalPreferences());
  assert.deepEqual(normalizePersonalPreferences({ notificationCategories: ['finance', 'unknown', 'finance'] }).notificationCategories, ['finance']);
  assert.deepEqual(normalizePersonalPreferences(null), defaultPersonalPreferences());
  for (const zone of ['studio', 'Asia/Kolkata', 'Asia/Dubai', 'America/New_York', 'UTC']) assert.equal(isValidPreferenceTimezone(zone), true);
  for (const zone of ['', null, 5, 'UTC+5', 'Asia/Unknown', 'A'.repeat(81)]) assert.equal(isValidPreferenceTimezone(zone), false);
  const copy = defaultPersonalPreferences(); copy.notificationCategories.pop(); assert.equal(defaultPersonalPreferences().notificationCategories.length, 6);
});
