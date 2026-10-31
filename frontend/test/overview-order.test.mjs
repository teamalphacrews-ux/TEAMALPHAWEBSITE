import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DEFAULT_CARD_ORDER, STUDIO_LANDING_PAGES, defaultOverviewPreferences, normalizeOverviewPreferences, moveOverviewCard } from '../src/utils/overviewPreferences.js';
const require = createRequire(import.meta.url);

test('fresh dashboards start with the schedule and agree with account storage defaults', () => {
  assert.deepEqual(defaultOverviewPreferences().cardOrder.slice(0, 5), ['upcomingSchedule','bookingMomentum','productionPulse','activityMap','enquiryPipeline']);
  assert.deepEqual(normalizeOverviewPreferences({ theme: 'dark', visibleCards: [] }).cardOrder, DEFAULT_CARD_ORDER);
  assert.deepEqual(require('../../backend/utils/studioPreferences').defaults().cardOrder, DEFAULT_CARD_ORDER);
});
test('ordering survives hidden cards, restores incomplete caches and never changes visibility or theme', () => {
  const value = normalizeOverviewPreferences({ theme: 'dark', layoutVersion: 2, visibleCards: ['actionQueue'], cardOrder: ['financePulse', 'actionQueue', 'financePulse', 'unknown'] });
  assert.equal(value.cardOrder.length, DEFAULT_CARD_ORDER.length); assert.equal(new Set(value.cardOrder).size, DEFAULT_CARD_ORDER.length);
  assert.deepEqual(value.cardOrder.slice(0, 2), ['financePulse', 'actionQueue']);
  assert.deepEqual(value.visibleCards, ['actionQueue','activityMap']); assert.equal(value.theme, 'dark');
});
test('move operations do not mutate saved layouts or wrap past either boundary', () => {
  const original = [...DEFAULT_CARD_ORDER];
  assert.deepEqual(moveOverviewCard(original, original[0], -1), original);
  assert.deepEqual(moveOverviewCard(original, original.at(-1), 1), original);
  const moved = moveOverviewCard(original, original[1], -1);
  assert.deepEqual(moved.slice(0, 2), [original[1],original[0]]);
  assert.deepEqual(original, DEFAULT_CARD_ORDER);
});
test('personal preferences migrate existing accounts and normalize unsafe cached destinations', () => {
  const legacy = normalizeOverviewPreferences({ theme: 'dark', visibleCards: [], cardOrder: [...DEFAULT_CARD_ORDER].reverse() });
  assert.equal(legacy.theme, 'dark'); assert.equal(legacy.reduceMotion, false); assert.equal(legacy.landingPage, '/admin');
  assert.deepEqual(legacy.visibleCards, []);
  const custom = normalizeOverviewPreferences({ theme: 'system', reduceMotion: true, landingPage: '/admin/calendar' });
  assert.equal(custom.theme, 'system'); assert.equal(custom.reduceMotion, true); assert.equal(custom.landingPage, '/admin/calendar');
  for (const landingPage of ['https://example.com', '//example.com', '/admin/calendar?unsafe=1', '/auth', null]) assert.equal(normalizeOverviewPreferences({ landingPage }).landingPage, '/admin');
  assert.equal(normalizeOverviewPreferences({ reduceMotion: 'true' }).reduceMotion, false);
  assert.deepEqual(STUDIO_LANDING_PAGES.map(page => page.value), require('../../backend/utils/studioPreferences').LANDING_PAGES);
  assert.deepEqual(defaultOverviewPreferences(), require('../../backend/utils/studioPreferences').defaults());
});
