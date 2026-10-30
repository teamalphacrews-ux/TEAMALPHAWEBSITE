import { defaultPersonalPreferences, normalizePersonalPreferences } from './personalPreferences.js';

export const OVERVIEW_CARDS = [
  { id: 'openEnquiries', label: 'Open enquiries', group: 'At a glance' },
  { id: 'bookedProjects', label: 'Booked projects', group: 'At a glance' },
  { id: 'upcomingEvents', label: 'Upcoming events', group: 'At a glance' },
  { id: 'pendingTasks', label: 'Pending tasks', group: 'At a glance' },
  { id: 'bookingMomentum', label: 'Booking momentum', group: 'Featured cards' },
  { id: 'productionPulse', label: 'Studio rhythm', group: 'Featured cards' },
  { id: 'financePulse', label: 'Finance pulse', group: 'Featured cards' },
  { id: 'upcomingSchedule', label: 'Upcoming schedule', group: 'Workspace cards' },
  { id: 'actionQueue', label: 'Action queue', group: 'Workspace cards' },
  { id: 'activityMap', label: 'Activity map', group: 'Workspace cards' },
  { id: 'enquiryPipeline', label: 'Pipeline performance', group: 'Workspace cards' },
  { id: 'recentEnquiries', label: 'Recent enquiries', group: 'Workspace cards' },
  { id: 'quickActions', label: 'Quick access', group: 'Workspace cards' },
];
const PREVIOUS_CARD_ORDER = ['bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
export const DEFAULT_CARD_ORDER = ['upcomingSchedule', 'bookingMomentum', 'productionPulse', 'activityMap', 'enquiryPipeline', 'financePulse', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'recentEnquiries', 'quickActions'];
export const STUDIO_LANDING_PAGES = [
  { value: '/admin', label: 'Overview' },
  { value: '/admin/crm', label: 'Enquiries' },
  { value: '/admin/calendar', label: 'Calendar' },
  { value: '/admin/studio-projects', label: 'Projects' },
  { value: '/admin/finance', label: 'Finance' },
  { value: '/admin/post-production', label: 'Post production' },
];
export const normalizeLandingPage = value => STUDIO_LANDING_PAGES.some(page => page.value === value) ? value : '/admin';
export const defaultOverviewPreferences = () => ({ theme: 'light', reduceMotion: false, landingPage: '/admin', layoutVersion: 3, visibleCards: OVERVIEW_CARDS.map(card => card.id), cardOrder: [...DEFAULT_CARD_ORDER], ...defaultPersonalPreferences() });
export function moveOverviewCard(order, id, direction) {
  const next = [...order];
  const index = next.indexOf(id), target = index + direction;
  if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
/** Reorder only the shown cards; hidden cards retain their saved slots. */
export function reorderVisibleOverviewCards(order, visibleCards, nextVisibleOrder) {
  const shown = new Set(visibleCards);
  const currentVisible = order.filter(id => shown.has(id));
  if (nextVisibleOrder.length !== currentVisible.length || new Set(nextVisibleOrder).size !== currentVisible.length || nextVisibleOrder.some(id => !currentVisible.includes(id))) return [...order];
  let index = 0;
  return order.map(id => shown.has(id) ? nextVisibleOrder[index++] : id);
}
export function normalizeOverviewPreferences(value) {
  const ids = OVERVIEW_CARDS.map(card => card.id);
  let visibleCards = Array.isArray(value?.visibleCards) ? [...new Set(value.visibleCards.filter(id => ids.includes(id)))] : ids;
  // Introduce the new card once; keep deliberately empty layouts and later opt-outs.
  if ((value?.layoutVersion || 1) < 2 && visibleCards.length && !visibleCards.includes('financePulse')) visibleCards = [...visibleCards, 'financePulse'];
  if ((value?.layoutVersion || 1) < 3 && visibleCards.length && !visibleCards.includes('activityMap')) visibleCards = [...visibleCards, 'activityMap'];
  let suppliedOrder = Array.isArray(value?.cardOrder) ? value.cardOrder : [];
  if ((value?.layoutVersion || 1) < 3 && JSON.stringify(suppliedOrder) === JSON.stringify(PREVIOUS_CARD_ORDER)) suppliedOrder = DEFAULT_CARD_ORDER;
  const cardOrder = [...new Set([...suppliedOrder.filter(id => ids.includes(id)), ...DEFAULT_CARD_ORDER])];
  return { theme: ['light', 'dark', 'system'].includes(value?.theme) ? value.theme : 'light', reduceMotion: value?.reduceMotion === true, landingPage: normalizeLandingPage(value?.landingPage), layoutVersion: 3, visibleCards, cardOrder, ...normalizePersonalPreferences(value) };
}
