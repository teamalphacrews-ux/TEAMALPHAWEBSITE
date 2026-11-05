export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', nativeName: 'English', locale: 'en-IN' },
  { value: 'hi', label: 'Hindi', nativeName: 'हिन्दी', locale: 'hi-IN' },
  { value: 'bn', label: 'Bengali', nativeName: 'বাংলা', locale: 'bn-IN' },
  { value: 'mr', label: 'Marathi', nativeName: 'मराठी', locale: 'mr-IN' },
  { value: 'te', label: 'Telugu', nativeName: 'తెలుగు', locale: 'te-IN' },
  { value: 'ta', label: 'Tamil', nativeName: 'தமிழ்', locale: 'ta-IN' },
  { value: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', locale: 'gu-IN' },
  { value: 'ur', label: 'Urdu', nativeName: 'اردو', locale: 'ur-IN' },
  { value: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', locale: 'kn-IN' },
  { value: 'or', label: 'Odia', nativeName: 'ଓଡ଼ିଆ', locale: 'or-IN' },
  { value: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', locale: 'ml-IN' },
];
export const REGION_OPTIONS = [
  { value: 'IN', label: 'India', locale: 'en-IN' },
  { value: 'US', label: 'United States', locale: 'en-US' },
  { value: 'GB', label: 'United Kingdom', locale: 'en-GB' },
  { value: 'AE', label: 'United Arab Emirates', locale: 'en-AE' },
  { value: 'SG', label: 'Singapore', locale: 'en-SG' },
  { value: 'AU', label: 'Australia', locale: 'en-AU' },
  { value: 'CA', label: 'Canada', locale: 'en-CA' },
];
export const NOTIFICATION_CATEGORY_OPTIONS = [
  { value: 'enquiries', label: 'Enquiries' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'tasks', label: 'Tasks & production' },
  { value: 'finance', label: 'Invoices & payments' },
  { value: 'messages', label: 'Client messages' },
  { value: 'system', label: 'Studio updates' },
];
const categories = NOTIFICATION_CATEGORY_OPTIONS.map(option => option.value);
const clockTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function isValidPreferenceTimezone(value) {
  if (value === 'studio') return true;
  if (typeof value !== 'string' || value.length > 80 || !/^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC|GMT)$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}
export const defaultPersonalPreferences = () => ({
  mobileTab: 'projects', overviewMode: 'today', textSize: 'compact', showInspiration: true, showActivityStreak: false,
  language: 'en', region: 'IN', timezone: 'studio', dateFormat: 'day-first', timeFormat: '12h', numberFormat: 'indian',
  notificationBadges: true, notificationToasts: true, notificationSound: false, notificationVolume: 50, notificationTone: 'chime',
  notificationCategories: [...categories], quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '08:00',
});
export function normalizePersonalPreferences(value) {
  const base = defaultPersonalPreferences();
  const supplied = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  for (const [key, options] of Object.entries({ mobileTab: ['projects','finance'], overviewMode: ['today','insights'], textSize: ['compact','comfortable'], language: LANGUAGE_OPTIONS.map(option => option.value), region: REGION_OPTIONS.map(option => option.value), dateFormat: ['day-first', 'month-first', 'iso'], timeFormat: ['12h', '24h'], numberFormat: ['indian', 'international'], notificationTone: ['chime', 'soft', 'bell'] })) if (options.includes(supplied[key])) base[key] = supplied[key];
  if (isValidPreferenceTimezone(supplied.timezone)) base.timezone = supplied.timezone;
  for (const key of ['notificationBadges', 'notificationToasts', 'notificationSound', 'quietHoursEnabled', 'showInspiration', 'showActivityStreak']) if (typeof supplied[key] === 'boolean') base[key] = supplied[key];
  if (Number.isInteger(supplied.notificationVolume) && supplied.notificationVolume >= 0 && supplied.notificationVolume <= 100) base.notificationVolume = supplied.notificationVolume;
  if (Array.isArray(supplied.notificationCategories)) base.notificationCategories = [...new Set(supplied.notificationCategories.filter(category => categories.includes(category)))];
  for (const key of ['quietHoursStart', 'quietHoursEnd']) if (clockTime(supplied[key])) base[key] = supplied[key];
  return base;
}
