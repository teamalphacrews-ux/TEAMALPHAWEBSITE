import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DEFAULT_CARD_ORDER, defaultOverviewPreferences, normalizeOverviewPreferences, moveOverviewCard } from '../src/utils/overviewPreferences.js';
const require = createRequire(import.meta.url);

test('fresh and legacy dashboards place feature cards above work and agree with account storage defaults', () => {
  assert.deepEqual(defaultOverviewPreferences().cardOrder.slice(0, 5), ['bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue']);
  assert.deepEqual(normalizeOverviewPreferences({ theme: 'dark', visibleCards: [] }).cardOrder, DEFAULT_CARD_ORDER);
  assert.deepEqual(require('../../backend/utils/studioPreferences').defaults().cardOrder, DEFAULT_CARD_ORDER);
});
test('ordering survives hidden cards, restores incomplete caches and never changes visibility or theme', () => {
  const value = normalizeOverviewPreferences({ theme: 'dark', layoutVersion: 2, visibleCards: ['actionQueue'], cardOrder: ['financePulse', 'actionQueue', 'financePulse', 'unknown'] });
  assert.equal(value.cardOrder.length, 12); assert.equal(new Set(value.cardOrder).size, 12);
  assert.deepEqual(value.cardOrder.slice(0, 2), ['financePulse', 'actionQueue']);
  assert.deepEqual(value.visibleCards, ['actionQueue']); assert.equal(value.theme, 'dark');
});
test('move operations do not mutate saved layouts or wrap past either boundary', () => {
  const original = [...DEFAULT_CARD_ORDER];
  assert.deepEqual(moveOverviewCard(original, original[0], -1), original);
  assert.deepEqual(moveOverviewCard(original, original.at(-1), 1), original);
  const moved = moveOverviewCard(original, original[1], -1);
  assert.deepEqual(moved.slice(0, 2), ['productionPulse', 'bookingMomentum']);
  assert.deepEqual(original, DEFAULT_CARD_ORDER);
});
