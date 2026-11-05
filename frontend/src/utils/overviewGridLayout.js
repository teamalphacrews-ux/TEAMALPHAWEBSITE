import { OVERVIEW_CARDS } from './overviewPreferences.js';

const cardIds = new Set(OVERVIEW_CARDS.map(card => card.id));
const statIds = new Set(OVERVIEW_CARDS.filter(card => card.group === 'At a glance').map(card => card.id));
const insightIds = new Set(['bookingMomentum', 'productionPulse', 'activityMap', 'enquiryPipeline']);
const todayOrder = ['upcomingSchedule', 'actionQueue', 'financePulse', 'recentEnquiries', 'inspiration', 'quickActions'];
const desktopSpans = {
  upcomingSchedule: 4, bookingMomentum: 4, financePulse: 4,
  productionPulse: 8, actionQueue: 8, activityMap: 7, enquiryPipeline: 5,
  recentEnquiries: 12, quickActions: 12, activityStreak: 12,
};

function preferredSpan(id, viewport, todayMode, firstCard) {
  if (id === 'activityStreak' || id === 'quickActions') return 12;
  if (id === 'inspiration') return !todayMode && viewport === 'desktop' && firstCard === 'upcomingSchedule' ? 8 : 12;
  if (statIds.has(id)) return viewport === 'phone' ? 6 : 3;
  if (viewport === 'phone') return 12;
  if (todayMode) return 6;
  if (viewport === 'tablet') return ['productionPulse', 'activityMap', 'actionQueue', 'recentEnquiries'].includes(id) ? 12 : 6;
  return desktopSpans[id] || 6;
}

/** Fill each consecutive row; never move a later card ahead to occupy a hole. */
function fillRows(items, viewport, todayMode, firstCard) {
  let row = [];
  let used = 0;
  const finishRow = () => {
    if (!row.length) return;
    const widths = row.map(item => {
      const exact = item.preferred / used * 12;
      return { ...item, span: Math.floor(exact), fraction: exact % 1 };
    });
    let remaining = 12 - widths.reduce((total, item) => total + item.span, 0);
    // Largest remainders keep the established proportions, with stable tie breaks.
    for (const item of [...widths].sort((a, b) => b.fraction - a.fraction)) {
      if (remaining-- <= 0) break;
      item.span += 1;
    }
    for (const item of widths) item.card.spans[viewport] = item.span;
    row = [];
    used = 0;
  };
  for (const card of items) {
    const preferred = preferredSpan(card.id, viewport, todayMode, firstCard);
    if (used + preferred > 12) finishRow();
    row.push({ card, preferred });
    used += preferred;
    if (used === 12) finishRow();
  }
  finishRow();
}

/** Derive the rendered cards and all responsive spans without changing saved preferences. */
export function buildOverviewGridLayout(cardOrder, visibleCards, { todayMode = false, showInspiration = true, showActivityStreak = true } = {}) {
  const visible = new Set(Array.isArray(visibleCards) ? visibleCards : []);
  const savedOrder = [...new Set(Array.isArray(cardOrder) ? cardOrder : [])].filter(id => cardIds.has(id) && visible.has(id));
  // Today retains its established task-first order; Insights follows the user's saved order.
  const visibleOrder = todayMode ? todayOrder.filter(id => savedOrder.includes(id)) : savedOrder;
  const displayOrder = todayMode
    ? todayOrder.filter(id => id === 'inspiration' ? showInspiration : visibleOrder.includes(id))
    : [...(showInspiration ? ['inspiration'] : []), ...visibleOrder];
  const lastInsight = visibleOrder.filter(id => insightIds.has(id)).at(-1);
  const items = displayOrder.flatMap(id => [
    { id, spans: {} },
    ...(!todayMode && showActivityStreak && id === lastInsight ? [{ id: 'activityStreak', spans: {} }] : []),
  ]);
  for (const viewport of ['desktop', 'tablet', 'phone']) fillRows(items, viewport, todayMode, visibleOrder[0]);
  return { visibleOrder, items };
}
