export const OVERVIEW_CARDS = [
  { id: 'openEnquiries', label: 'Open enquiries', group: 'At a glance' },
  { id: 'bookedProjects', label: 'Booked projects', group: 'At a glance' },
  { id: 'upcomingEvents', label: 'Upcoming events', group: 'At a glance' },
  { id: 'pendingTasks', label: 'Pending tasks', group: 'At a glance' },
  { id: 'bookingMomentum', label: 'Booking momentum', group: 'Featured cards' },
  { id: 'productionPulse', label: 'Production pulse', group: 'Featured cards' },
  { id: 'financePulse', label: 'Finance pulse', group: 'Featured cards' },
  { id: 'upcomingSchedule', label: 'Upcoming schedule', group: 'Workspace cards' },
  { id: 'actionQueue', label: 'Action queue', group: 'Workspace cards' },
  { id: 'enquiryPipeline', label: 'Enquiry pipeline', group: 'Workspace cards' },
  { id: 'recentEnquiries', label: 'Recent enquiries', group: 'Workspace cards' },
  { id: 'quickActions', label: 'Quick access', group: 'Workspace cards' },
];
export const DEFAULT_CARD_ORDER = ['bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
export const defaultOverviewPreferences = () => ({ theme: 'light', layoutVersion: 2, visibleCards: OVERVIEW_CARDS.map(card => card.id), cardOrder: [...DEFAULT_CARD_ORDER] });
export function moveOverviewCard(order, id, direction) {
  const next = [...order];
  const index = next.indexOf(id), target = index + direction;
  if (![-1, 1].includes(direction) || index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function normalizeOverviewPreferences(value) {
  const ids = OVERVIEW_CARDS.map(card => card.id);
  let visibleCards = Array.isArray(value?.visibleCards) ? [...new Set(value.visibleCards.filter(id => ids.includes(id)))] : ids;
  // Introduce the new card once; keep deliberately empty layouts and later opt-outs.
  if (value?.layoutVersion !== 2 && visibleCards.length && !visibleCards.includes('financePulse')) visibleCards = [...visibleCards, 'financePulse'];
  const suppliedOrder = Array.isArray(value?.cardOrder) ? value.cardOrder : [];
  const cardOrder = [...new Set([...suppliedOrder.filter(id => ids.includes(id)), ...DEFAULT_CARD_ORDER])];
  return { theme: value?.theme === 'dark' ? 'dark' : 'light', layoutVersion: 2, visibleCards, cardOrder };
}
