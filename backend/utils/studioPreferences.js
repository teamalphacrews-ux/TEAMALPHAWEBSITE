const CARD_IDS = ['openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
const DEFAULT_CARD_ORDER = ['bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
const defaults = () => ({ theme: 'light', layoutVersion: 2, visibleCards: [...CARD_IDS], cardOrder: [...DEFAULT_CARD_ORDER] });
function parsePreferences(body) {
  const fail = () => { throw Object.assign(new Error('Choose a valid appearance and overview card selection.'), { status: 400 }); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
  const result = {};
  if (Object.keys(body).some(key => !['theme', 'visibleCards', 'layoutVersion', 'cardOrder'].includes(key))) fail();
  if (body.theme !== undefined) { if (!['light', 'dark'].includes(body.theme)) fail(); result.theme = body.theme; }
  if (body.visibleCards !== undefined) { if (!Array.isArray(body.visibleCards) || body.visibleCards.length > CARD_IDS.length || body.visibleCards.some(id => !CARD_IDS.includes(id)) || new Set(body.visibleCards).size !== body.visibleCards.length) fail(); result.visibleCards = [...body.visibleCards]; }
  if (body.layoutVersion !== undefined) { if (body.layoutVersion !== 2) fail(); result.layoutVersion = 2; }
  if (body.cardOrder !== undefined) {
    if (!Array.isArray(body.cardOrder) || body.cardOrder.length !== CARD_IDS.length || body.cardOrder.some(id => !CARD_IDS.includes(id)) || new Set(body.cardOrder).size !== CARD_IDS.length) fail();
    result.cardOrder = [...body.cardOrder];
  }
  return result;
}
module.exports = { CARD_IDS, DEFAULT_CARD_ORDER, defaults, parsePreferences };
