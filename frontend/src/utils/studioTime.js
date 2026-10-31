export const DEFAULT_STUDIO_TIMEZONE = 'Asia/Kolkata';
const validTimezones = new Map();
const formatters = new Map();
const dayBoundsCache = new Map();
const remember = (cache, key, value, limit) => {
  if (cache.size >= limit && !cache.has(key)) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};

export function studioTimezone(value) {
  if (!value) return DEFAULT_STUDIO_TIMEZONE;
  if (validTimezones.has(value)) return validTimezones.get(value);
  let timezone = DEFAULT_STUDIO_TIMEZONE;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); timezone = value; }
  catch { /* Retain the studio's default for invalid saved values. */ }
  remember(validTimezones, value, timezone, 32);
  return timezone;
}

const partsAt = (value, timezone) => {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const zone = studioTimezone(timezone);
  if (!formatters.has(zone)) remember(formatters, zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), 32);
  return Object.fromEntries(formatters.get(zone).formatToParts(date).map(part => [part.type, part.value]));
};

export function studioDayKey(value, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const parts = partsAt(value, timezone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function studioDateTimeInput(value, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const parts = partsAt(value, timezone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : '';
}

export function formatStudioDate(value, options = {}, timezone = DEFAULT_STUDIO_TIMEZONE) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...options, timeZone: studioTimezone(timezone) }).format(date) : 'Not scheduled';
}

export function formatStudioTime(value, timezone = DEFAULT_STUDIO_TIMEZONE) {
  if (value == null || value === '') return 'Time not set';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { timeZone: studioTimezone(timezone), hour: 'numeric', minute: '2-digit' }).format(date) : 'Time not set';
}

export const shiftDayKey = (key, days) => {
  const date = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Convert a wall-clock input in the studio timezone to an instant. Checking
// candidate offsets also rejects nonexistent times during a DST transition.
export function studioDateTimeToISO(input, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(input || ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(wall).toISOString().slice(0, 16) !== input) return null;
  const candidates = new Set();
  for (const hours of [-36, -24, 0, 24, 36]) {
    const probe = wall + hours * 3600000;
    const parts = partsAt(probe, timezone);
    const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - probe;
    const candidate = wall - offset;
    if (studioDateTimeInput(candidate, timezone) === input) candidates.add(candidate);
  }
  return candidates.size ? new Date(Math.min(...candidates)).toISOString() : null;
}

export function studioDayBounds(key, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const cacheKey = `${studioTimezone(timezone)}:${key}`;
  if (!dayBoundsCache.has(cacheKey)) {
    remember(dayBoundsCache, cacheKey, { start: studioDateTimeToISO(`${key}T00:00`, timezone), end: studioDateTimeToISO(`${shiftDayKey(key, 1)}T00:00`, timezone) }, 256);
  }
  return dayBoundsCache.get(cacheKey);
}

export const validStudioDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export const hasAllDayRange = event => event?.allDay === true && validStudioDay(event.startDate) && validStudioDay(event.endDateExclusive) && event.endDateExclusive > event.startDate;
export const eventStartDay = (event, timezone = DEFAULT_STUDIO_TIMEZONE) => hasAllDayRange(event) ? event.startDate : studioDayKey(event?.start, timezone);

export function eventOnStudioDay(event, key, timezone = DEFAULT_STUDIO_TIMEZONE) {
  if (hasAllDayRange(event)) return validStudioDay(key) && event.startDate <= key && key < event.endDateExclusive;
  const bounds = studioDayBounds(key, timezone);
  const start = Date.parse(event.start), end = Date.parse(event.end);
  return !!bounds.start && !!bounds.end && Number.isFinite(start) && Number.isFinite(end) && end > start && start < Date.parse(bounds.end) && end > Date.parse(bounds.start);
}

export const dayKeyDifference = (later, earlier) => Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);
