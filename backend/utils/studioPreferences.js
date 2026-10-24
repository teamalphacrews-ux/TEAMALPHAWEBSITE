const CARD_IDS = ['openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
const defaults = () => ({ theme: 'light', layoutVersion: 2, visibleCards: [...CARD_IDS] });
function parsePreferences(body) {
  const fail = () => { throw Object.assign(new Error('Choose a valid appearance and overview card selection.'), { status: 400 }); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
  const result = {};
  if (Object.keys(body).some(key => !['theme', 'visibleCards', 'layoutVersion'].includes(key))) fail();
  if (body.theme !== undefined) { if (!['light', 'dark'].includes(body.theme)) fail(); result.theme = body.theme; }
  if (body.visibleCards !== undefined) { if (!Array.isArray(body.visibleCards) || body.visibleCards.length > CARD_IDS.length || body.visibleCards.some(id => !CARD_IDS.includes(id)) || new Set(body.visibleCards).size !== body.visibleCards.length) fail(); result.visibleCards = [...body.visibleCards]; }
  if (body.layoutVersion !== undefined) { if (body.layoutVersion !== 2) fail(); result.layoutVersion = 2; }
  return result;
}
module.exports = { CARD_IDS, defaults, parsePreferences };
