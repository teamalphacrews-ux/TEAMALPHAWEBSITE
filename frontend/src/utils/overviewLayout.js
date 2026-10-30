import { OVERVIEW_CARDS } from './overviewPreferences.js';

const kinds = new Map(OVERVIEW_CARDS.map(card => [card.id,
  card.id === 'quickActions' ? 'quick'
    : card.group === 'Featured cards' ? 'feature'
      : card.group === 'At a glance' ? 'stat' : 'work',
]));

function describe(kind, ids) {
  if (kind === 'feature') return { title: 'Studio pulse', description: 'Bookings, production and finances.' };
  if (kind === 'stat') return { title: 'At a glance', description: 'The numbers behind your studio.' };
  if (kind === 'quick') return { title: 'Quick access', description: '' };
  if (ids.every(id => ['upcomingSchedule', 'actionQueue'].includes(id))) {
    return { title: 'Today & next', description: 'Your schedule and the work that needs attention.' };
  }
  if (ids.every(id => ['enquiryPipeline', 'recentEnquiries'].includes(id))) {
    return { title: 'Client relationships', description: 'From first conversation to confirmed booking.' };
  }
  return { title: 'Your workspace', description: 'Your schedule, tasks and client conversations.' };
}

/** Pack adjacent card families without changing the user's visual or keyboard order. */
export function buildOverviewSections(cardOrder, visibleCards) {
  const visible = new Set(Array.isArray(visibleCards) ? visibleCards : []);
  const seen = new Set();
  const sections = [];
  for (const id of Array.isArray(cardOrder) ? cardOrder : []) {
    const kind = kinds.get(id);
    if (!kind || !visible.has(id) || seen.has(id)) continue;
    seen.add(id);
    const previous = sections.at(-1);
    if (previous?.kind === kind) previous.ids.push(id);
    else sections.push({ key: `${kind}-${id}`, kind, ids: [id] });
  }
  return sections.map(section => ({ ...section, ...describe(section.kind, section.ids) }));
}
