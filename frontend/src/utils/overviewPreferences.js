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
export const defaultOverviewPreferences = () => ({ theme: 'light', layoutVersion: 2, visibleCards: OVERVIEW_CARDS.map(card => card.id) });
export function normalizeOverviewPreferences(value) {
  const ids = OVERVIEW_CARDS.map(card => card.id);
  let visibleCards = Array.isArray(value?.visibleCards) ? [...new Set(value.visibleCards.filter(id => ids.includes(id)))] : ids;
  // Introduce the new card once; keep deliberately empty layouts and later opt-outs.
  if (value?.layoutVersion !== 2 && visibleCards.length && !visibleCards.includes('financePulse')) visibleCards = [...visibleCards, 'financePulse'];
  return { theme: value?.theme === 'dark' ? 'dark' : 'light', layoutVersion: 2, visibleCards };
}
