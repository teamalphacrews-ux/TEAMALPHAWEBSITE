import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CARD_ORDER } from '../src/utils/overviewPreferences.js';
import { buildOverviewGridLayout } from '../src/utils/overviewGridLayout.js';

const viewports = ['desktop', 'tablet', 'phone'];
const cardsOnly = items => items.filter(item => DEFAULT_CARD_ORDER.includes(item.id)).map(item => item.id);
const rowsFor = (items, viewport) => {
  const rows = [];
  let row = [];
  let total = 0;
  for (const item of items) {
    const span = item.spans[viewport];
    assert.ok(Number.isInteger(span) && span >= 1 && span <= 12, `${item.id}: invalid ${viewport} span`);
    total += span;
    assert.ok(total <= 12, `${viewport}: a row leaves a hole before ${item.id}`);
    row.push(item.id);
    if (total === 12) { rows.push(row); row = []; total = 0; }
  }
  assert.equal(total, 0, `${viewport}: trailing row must fill the available width`);
  return rows;
};

test('the default desktop composition retains its established card pairings', () => {
  const { items } = buildOverviewGridLayout(DEFAULT_CARD_ORDER, DEFAULT_CARD_ORDER);
  assert.deepEqual(rowsFor(items, 'desktop'), [
    ['inspiration', 'upcomingSchedule'], ['bookingMomentum', 'productionPulse'],
    ['activityMap', 'enquiryPipeline'], ['activityStreak'], ['financePulse', 'actionQueue'],
    ['openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks'],
    ['recentEnquiries'], ['quickActions'],
  ]);
  assert.deepEqual(items.slice(0, 6).map(item => item.spans.desktop), [8, 4, 4, 8, 7, 5]);
});

test('unpaired insight and work cards fill their rows when neighboring cards are hidden', () => {
  for (const id of DEFAULT_CARD_ORDER) {
    const { items } = buildOverviewGridLayout(DEFAULT_CARD_ORDER, [id], { showInspiration: false, showActivityStreak: false });
    assert.deepEqual(items, [{ id, spans: { desktop: 12, tablet: 12, phone: 12 } }]);
  }
  const { items } = buildOverviewGridLayout(DEFAULT_CARD_ORDER, ['productionPulse', 'activityMap'], { showInspiration: false });
  assert.deepEqual(rowsFor(items, 'desktop'), [['productionPulse'], ['activityMap'], ['activityStreak']]);
});

test('partial metric rows grow evenly and phone rows remain readable', () => {
  const visible = ['openEnquiries', 'bookedProjects', 'pendingTasks'];
  const { items } = buildOverviewGridLayout(DEFAULT_CARD_ORDER, visible, { showInspiration: false });
  assert.deepEqual(items.map(item => item.spans.desktop), [4, 4, 4]);
  assert.deepEqual(items.map(item => item.spans.tablet), [4, 4, 4]);
  assert.deepEqual(items.map(item => item.spans.phone), [6, 6, 12]);
  assert.deepEqual(rowsFor(items, 'phone'), [['openEnquiries', 'bookedProjects'], ['pendingTasks']]);
});

test('custom interleaved order remains identical across all responsive layouts and restoration', () => {
  const order = ['financePulse', 'actionQueue', 'bookedProjects', 'productionPulse', 'enquiryPipeline', 'quickActions', 'bookingMomentum'];
  const snapshot = [...order];
  const visible = order.filter(id => id !== 'actionQueue');
  const hidden = buildOverviewGridLayout(order, visible, { showInspiration: false });
  assert.deepEqual(hidden.visibleOrder, visible);
  assert.deepEqual(cardsOnly(hidden.items), visible);
  for (const viewport of viewports) assert.deepEqual(rowsFor(hidden.items, viewport).flat().filter(id => id !== 'activityStreak'), visible);
  assert.deepEqual(cardsOnly(buildOverviewGridLayout(order, order).items), order);
  assert.deepEqual(order, snapshot);
});

test('Today preserves its existing task-first order and expands an odd remaining card', () => {
  const order = [...DEFAULT_CARD_ORDER].reverse();
  const { visibleOrder, items } = buildOverviewGridLayout(order, ['recentEnquiries', 'upcomingSchedule', 'financePulse'], { todayMode: true, showInspiration: false });
  assert.deepEqual(visibleOrder, ['upcomingSchedule', 'financePulse', 'recentEnquiries']);
  assert.deepEqual(items.map(item => item.spans.desktop), [6, 6, 12]);
  assert.deepEqual(rowsFor(items, 'phone'), [['upcomingSchedule'], ['financePulse'], ['recentEnquiries']]);
  assert.ok(!items.some(item => item.id === 'activityStreak'));
});

test('empty, invalid and duplicate preferences do not create ghost slots', () => {
  const options = { showInspiration: false, showActivityStreak: false };
  assert.deepEqual(buildOverviewGridLayout(DEFAULT_CARD_ORDER, [], options), { visibleOrder: [], items: [] });
  assert.deepEqual(buildOverviewGridLayout(null, null, options), { visibleOrder: [], items: [] });
  const { items } = buildOverviewGridLayout(['unknown', 'financePulse', 'financePulse'], ['unknown', 'financePulse'], options);
  assert.deepEqual(items.map(item => item.id), ['financePulse']);
  const inspirationOnly = buildOverviewGridLayout(DEFAULT_CARD_ORDER, []).items;
  assert.deepEqual(inspirationOnly, [{ id: 'inspiration', spans: { desktop: 12, tablet: 12, phone: 12 } }]);
});

test('every visibility combination fills each responsive row without reordering or mutating preferences', () => {
  for (let mask = 0; mask < 2 ** DEFAULT_CARD_ORDER.length; mask++) {
    const visible = DEFAULT_CARD_ORDER.filter((_, index) => mask & (1 << index));
    const snapshot = [...visible];
    for (const todayMode of [false, true]) {
      for (const showInspiration of [false, true]) {
        const { visibleOrder, items } = buildOverviewGridLayout(DEFAULT_CARD_ORDER, visible, { todayMode, showInspiration });
        assert.deepEqual(cardsOnly(items), visibleOrder);
        assert.equal(new Set(items.map(item => item.id)).size, items.length);
        for (const viewport of viewports) rowsFor(items, viewport);
      }
    }
    assert.deepEqual(visible, snapshot);
  }
});
