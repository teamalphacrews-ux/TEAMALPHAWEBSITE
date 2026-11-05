import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CARD_ORDER, normalizeOverviewPreferences, reorderVisibleOverviewCards } from '../src/utils/overviewPreferences.js';
import { buildOverviewSections } from '../src/utils/overviewLayout.js';

const flatten = sections => sections.flatMap(section => section.ids);

test('dragging visible cards preserves hidden slots and does not lose any cards', () => {
  const order = ['bookingMomentum', 'financePulse', 'actionQueue', 'upcomingSchedule'];
  const visible = ['bookingMomentum', 'actionQueue', 'upcomingSchedule'];
  const next = reorderVisibleOverviewCards(order, visible, ['upcomingSchedule', 'bookingMomentum', 'actionQueue']);
  assert.deepEqual(next, ['upcomingSchedule', 'financePulse', 'bookingMomentum', 'actionQueue']);
  assert.deepEqual(order, ['bookingMomentum', 'financePulse', 'actionQueue', 'upcomingSchedule']);
  const saved = normalizeOverviewPreferences({ layoutVersion: 3, cardOrder: next, visibleCards: visible });
  assert.deepEqual(saved.cardOrder.slice(0, 4), next);
  assert.deepEqual(saved.cardOrder.filter(id => saved.visibleCards.includes(id)), ['upcomingSchedule', 'bookingMomentum', 'actionQueue']);
});

test('stale or malformed drag results cannot duplicate, remove or introduce cards', () => {
  const order = ['bookingMomentum', 'financePulse', 'actionQueue'];
  for (const dropped of [['bookingMomentum'], ['bookingMomentum', 'bookingMomentum'], ['bookingMomentum', 'unknown']]) {
    assert.deepEqual(reorderVisibleOverviewCards(order, ['bookingMomentum', 'actionQueue'], dropped), order);
  }
  assert.deepEqual(reorderVisibleOverviewCards(order, [], []), order);
});

test('reference migration upgrades the previous default but retains deliberate personal layouts', () => {
  const oldOrder = ['bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
  const migrated = normalizeOverviewPreferences({ layoutVersion: 2, cardOrder: oldOrder, visibleCards: oldOrder });
  assert.deepEqual(migrated.cardOrder, DEFAULT_CARD_ORDER);
  assert.ok(migrated.visibleCards.includes('activityMap'));
  assert.equal(migrated.layoutVersion, 3);
  const personalOrder = [...oldOrder].reverse();
  const personal = normalizeOverviewPreferences({ layoutVersion: 2, cardOrder: personalOrder, visibleCards: ['financePulse'] });
  assert.deepEqual(personal.cardOrder, [...personalOrder, 'activityMap']);
  assert.deepEqual(personal.visibleCards, ['financePulse', 'activityMap']);
  assert.deepEqual(normalizeOverviewPreferences({ layoutVersion: 2, visibleCards: [] }).visibleCards, []);
  assert.deepEqual(normalizeOverviewPreferences({ layoutVersion: 3, visibleCards: ['financePulse'] }).visibleCards, ['financePulse']);
});

test('reference layout begins with the day planner and preserves the saved chart order', () => {
  const sections = buildOverviewSections(DEFAULT_CARD_ORDER, DEFAULT_CARD_ORDER);
  assert.deepEqual(flatten(sections), DEFAULT_CARD_ORDER);
  assert.equal(DEFAULT_CARD_ORDER[0], 'upcomingSchedule');
  assert.deepEqual(DEFAULT_CARD_ORDER.slice(1, 5), ['bookingMomentum', 'productionPulse', 'activityMap', 'enquiryPipeline']);
});

test('interleaved custom ordering is not sorted back into fixed category buckets', () => {
  const order = ['financePulse', 'actionQueue', 'bookedProjects', 'productionPulse', 'enquiryPipeline', 'quickActions', 'bookingMomentum'];
  const snapshot = [...order];
  const sections = buildOverviewSections(order, order);
  assert.deepEqual(flatten(sections), order);
  assert.deepEqual(order, snapshot);
  assert.equal(new Set(sections.map(section => section.key)).size, sections.length);
  assert.deepEqual(sections.map(section => section.key), order.map((id, index) => `${['feature', 'work', 'stat', 'feature', 'work', 'quick', 'feature'][index]}-${id}`));
});

test('hiding cards closes gaps and restoring them recovers their original place', () => {
  const order = ['bookingMomentum', 'actionQueue', 'financePulse', 'upcomingSchedule', 'enquiryPipeline'];
  const hidden = buildOverviewSections(order, order.filter(id => id !== 'actionQueue'));
  assert.deepEqual(hidden[0].ids, ['bookingMomentum', 'financePulse']);
  assert.equal(hidden[1].title, 'Your workspace');
  const restored = buildOverviewSections(order, order);
  assert.deepEqual(flatten(restored), order);
  assert.deepEqual(restored.slice(0, 3).map(section => section.kind), ['feature', 'work', 'feature']);
});

test('empty visibility stays empty and invalid or repeated cached IDs cannot create extra cards', () => {
  assert.deepEqual(buildOverviewSections(DEFAULT_CARD_ORDER, []), []);
  assert.deepEqual(buildOverviewSections(null, DEFAULT_CARD_ORDER), []);
  assert.deepEqual(buildOverviewSections(DEFAULT_CARD_ORDER, null), []);
  assert.deepEqual(flatten(buildOverviewSections(['unknown', 'financePulse', 'financePulse', 'actionQueue'], ['unknown', 'financePulse'])), ['financePulse']);
});

test('every visibility combination preserves order and contains no empty or redundant sections', () => {
  for (let mask = 0; mask < 2 ** DEFAULT_CARD_ORDER.length; mask++) {
    const visible = DEFAULT_CARD_ORDER.filter((_, index) => mask & (1 << index));
    const sections = buildOverviewSections(DEFAULT_CARD_ORDER, visible);
    assert.deepEqual(flatten(sections), visible);
    sections.forEach((section, index) => {
      assert.ok(section.ids.length);
      assert.notEqual(section.kind, sections[index - 1]?.kind);
    });
  }
});
