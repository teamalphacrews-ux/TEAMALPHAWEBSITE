const CARD_IDS = ['openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'bookingMomentum', 'productionPulse', 'financePulse', 'upcomingSchedule', 'actionQueue', 'activityMap', 'enquiryPipeline', 'recentEnquiries', 'quickActions'];
const DEFAULT_CARD_ORDER = ['upcomingSchedule', 'bookingMomentum', 'productionPulse', 'activityMap', 'enquiryPipeline', 'financePulse', 'actionQueue', 'openEnquiries', 'bookedProjects', 'upcomingEvents', 'pendingTasks', 'recentEnquiries', 'quickActions'];
const LANDING_PAGES = ['/admin', '/admin/crm', '/admin/calendar', '/admin/studio-projects', '/admin/finance', '/admin/post-production'];
const LANGUAGES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'or', 'ml'];
const REGIONS = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA'];
const NOTIFICATION_CATEGORIES = ['enquiries', 'calendar', 'tasks', 'finance', 'messages', 'system'];
const PERSONAL_ENUMS = { mobileTab: ['projects','finance'], overviewMode: ['today','insights'], textSize: ['compact','comfortable'], language: LANGUAGES, region: REGIONS, dateFormat: ['day-first', 'month-first', 'iso'], timeFormat: ['12h', '24h'], numberFormat: ['indian', 'international'], notificationTone: ['chime', 'soft', 'bell'] };
const PERSONAL_BOOLEANS = ['notificationBadges', 'notificationToasts', 'notificationSound', 'quietHoursEnabled', 'showInspiration', 'showActivityStreak'];
const validClockTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function validTimezone(value) {
  if (value === 'studio') return true;
  if (typeof value !== 'string' || value.length > 80 || !/^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC|GMT)$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}
const personalDefaults = () => ({ mobileTab: 'projects', overviewMode: 'today', textSize: 'compact', showInspiration: true, showActivityStreak: false, language: 'en', region: 'IN', timezone: 'studio', dateFormat: 'day-first', timeFormat: '12h', numberFormat: 'indian', notificationBadges: true, notificationToasts: true, notificationSound: false, notificationVolume: 50, notificationTone: 'chime', notificationCategories: [...NOTIFICATION_CATEGORIES], quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '08:00' });
const defaults = () => ({ theme: 'light', reduceMotion: false, landingPage: '/admin', layoutVersion: 3, visibleCards: [...CARD_IDS], cardOrder: [...DEFAULT_CARD_ORDER], ...personalDefaults() });
function parsePreferences(body) {
  const fail = () => { throw Object.assign(new Error('Choose valid workspace, language, region and notification preferences.'), { status: 400 }); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
  const result = {};
  if (Object.keys(body).some(key => !Object.keys(defaults()).includes(key))) fail();
  if (body.theme !== undefined) { if (!['light', 'dark', 'system'].includes(body.theme)) fail(); result.theme = body.theme; }
  if (body.reduceMotion !== undefined) { if (typeof body.reduceMotion !== 'boolean') fail(); result.reduceMotion = body.reduceMotion; }
  if (body.landingPage !== undefined) { if (!LANDING_PAGES.includes(body.landingPage)) fail(); result.landingPage = body.landingPage; }
  if (body.visibleCards !== undefined) { if (!Array.isArray(body.visibleCards) || body.visibleCards.length > CARD_IDS.length || body.visibleCards.some(id => !CARD_IDS.includes(id)) || new Set(body.visibleCards).size !== body.visibleCards.length) fail(); result.visibleCards = [...body.visibleCards]; }
  if (body.layoutVersion !== undefined) { if (![2, 3].includes(body.layoutVersion)) fail(); result.layoutVersion = body.layoutVersion; }
  if (body.cardOrder !== undefined) {
    if (!Array.isArray(body.cardOrder) || ![CARD_IDS.length, CARD_IDS.length - 1].includes(body.cardOrder.length) || body.cardOrder.some(id => !CARD_IDS.includes(id)) || new Set(body.cardOrder).size !== body.cardOrder.length) fail();
    if (body.cardOrder.length === CARD_IDS.length - 1 && body.cardOrder.includes('activityMap')) fail();
    result.cardOrder = [...body.cardOrder, ...CARD_IDS.filter(id => !body.cardOrder.includes(id))];
  }
  for (const [key, options] of Object.entries(PERSONAL_ENUMS)) if (body[key] !== undefined) { if (!options.includes(body[key])) fail(); result[key] = body[key]; }
  for (const key of PERSONAL_BOOLEANS) if (body[key] !== undefined) { if (typeof body[key] !== 'boolean') fail(); result[key] = body[key]; }
  if (body.timezone !== undefined) { if (!validTimezone(body.timezone)) fail(); result.timezone = body.timezone; }
  if (body.notificationVolume !== undefined) { if (!Number.isInteger(body.notificationVolume) || body.notificationVolume < 0 || body.notificationVolume > 100) fail(); result.notificationVolume = body.notificationVolume; }
  if (body.notificationCategories !== undefined) {
    if (!Array.isArray(body.notificationCategories) || body.notificationCategories.length > NOTIFICATION_CATEGORIES.length || body.notificationCategories.some(category => !NOTIFICATION_CATEGORIES.includes(category)) || new Set(body.notificationCategories).size !== body.notificationCategories.length) fail();
    result.notificationCategories = [...body.notificationCategories];
  }
  for (const key of ['quietHoursStart', 'quietHoursEnd']) if (body[key] !== undefined) { if (!validClockTime(body[key])) fail(); result[key] = body[key]; }
  return result;
}
module.exports = { CARD_IDS, DEFAULT_CARD_ORDER, LANDING_PAGES, LANGUAGES, REGIONS, NOTIFICATION_CATEGORIES, PERSONAL_ENUMS, PERSONAL_BOOLEANS, personalDefaults, validTimezone, validClockTime, defaults, parsePreferences };
