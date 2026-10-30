import { studioTimezone, studioDateTimeToISO } from './studioTime.js';

const languages = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'or', 'ml'];
const regions = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA'];
export const workspaceLocale = preferences => `${languages.includes(preferences?.language) ? preferences.language : 'en'}-${regions.includes(preferences?.region) ? preferences.region : 'IN'}-u-nu-latn`;
export const resolveWorkspaceTimezone = (preferences, studioZone) => studioTimezone(preferences?.timezone && preferences.timezone !== 'studio' ? preferences.timezone : studioZone);

function dateValue(value, timezone) {
  if (value == null || value === '') return null;
  // A date-only value is a calendar date, not UTC midnight. Keep its day when
  // formatting in a different zone (including locations west of Greenwich).
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? studioDateTimeToISO(value + 'T12:00', timezone) : value;
  const date = new Date(instant ?? NaN);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatWorkspaceDate(value, preferences, studioZone, options) {
  const timezone = resolveWorkspaceTimezone(preferences, studioZone), date = dateValue(value, timezone);
  if (!date) return 'Not set';
  const locale = workspaceLocale(preferences);
  if (options) return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(date);
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
  if (preferences?.dateFormat === 'iso') return `${parts.year}-${parts.month}-${parts.day}`;
  if (preferences?.dateFormat === 'month-first') return `${parts.month}/${parts.day}/${parts.year}`;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatWorkspaceTime(value, preferences, studioZone) {
  const timezone = resolveWorkspaceTimezone(preferences, studioZone), date = dateValue(value, timezone);
  if (!date) return 'Time not set';
  return new Intl.DateTimeFormat(workspaceLocale(preferences), { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: preferences?.timeFormat === '24h' ? 'h23' : 'h12' }).format(date);
}

export function formatWorkspaceNumber(value, preferences, options = {}) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  // Keep clear standard digits; grouping is an explicit user preference.
  return new Intl.NumberFormat(preferences?.numberFormat === 'international' ? 'en-US' : 'en-IN', options).format(Number(value));
}
