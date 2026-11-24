import { DEFAULT_STUDIO_TIMEZONE, hasAllDayRange, formatStudioDate, shiftDayKey, studioDateTimeToISO, studioDayBounds, studioDayKey } from '../../../utils/studioTime.js';

const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value));

export function calendarCreationRequest(params, { day, timezone, leads, loading }) {
  const contactId = params.get('contact') || '';
  const projectId = params.get('project') || '';
  if (params.has('event') || (params.get('new') !== '1' && !contactId)) return null;
  // The data hook retains its last response during refresh. Wait only on the
  // initial lookup, so a refresh cannot unmount an in-progress project draft.
  if (projectId && loading && leads === undefined) return null;
  const lead = projectId && leads?.find(item => (item.studioProjectId?._id || item.studioProjectId) === projectId);
  const linked = Boolean(contactId || projectId);
  return {
    key: JSON.stringify(['new-event', contactId, projectId]),
    event: {
      ...(linked ? { title: 'Client session', type: 'Meeting', contactId: contactId || null, studioProjectId: projectId || null, lead: lead?._id || '' } : {}),
      start: studioDateTimeToISO(day + 'T10:00', timezone),
      end: studioDateTimeToISO(day + (linked ? 'T11:00' : 'T18:00'), timezone),
    },
  };
}

export const calendarMonthKey = (value, timezone = DEFAULT_STUDIO_TIMEZONE) => validMonth(value) ? value : studioDayKey(value, timezone).slice(0, 7);
export const calendarDateLabel = (key, options = {}, timezone = DEFAULT_STUDIO_TIMEZONE) => {
  const { start } = studioDayBounds(key, timezone);
  return start ? formatStudioDate(start, options, timezone) : 'Date not set';
};

export function calendarWeekDays(day) {
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  const monday = shiftDayKey(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDayKey(monday, index));
}

export function calendarMonthGrid(month) {
  if (!validMonth(month)) return [];
  const first = `${month}-01`;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = shiftDayKey(first, -((weekday + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => shiftDayKey(start, index));
}

export function shiftCalendarMonth(month, offset) {
  if (!validMonth(month) || !Number.isInteger(offset)) return '';
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 15)).toISOString().slice(0, 7);
}

// Keep all-day dates independent of viewer timezone. Timed intervals use the
// actual local day boundaries, including short and long days at DST changes.
export function indexCalendarDays(events, days, timezone) {
  const buckets = new Map();
  const ranges = days.map(key => {
    const bounds = studioDayBounds(key, timezone);
    const items = [];
    buckets.set(key, items);
    return { key, start: Date.parse(bounds.start), end: Date.parse(bounds.end), items };
  });
  for (const event of events) {
    if (hasAllDayRange(event)) {
      for (const day of ranges) {
        if (event.startDate <= day.key && day.key < event.endDateExclusive) day.items.push(event);
      }
    } else {
      const start = Date.parse(event.start), end = Date.parse(event.end);
      if (!(end > start)) continue;
      for (const day of ranges) {
        if (start < day.end && end > day.start) day.items.push(event);
      }
    }
  }
  return buckets;
}

export function calendarMonthLoad(events = [], month, timezone = DEFAULT_STUDIO_TIMEZONE, indexedDays) {
  const key = calendarMonthKey(month, timezone);
  if (!validMonth(key)) return { days: [], events: [], activeDays: 0, peak: 0 };
  const first = `${key}-01`;
  const next = `${shiftCalendarMonth(key, 1)}-01`;
  const { start } = studioDayBounds(first, timezone);
  const { start: end } = studioDayBounds(next, timezone);
  const startTime = Date.parse(start), endTime = Date.parse(end);
  const valid = events.filter(event => {
    if (hasAllDayRange(event)) return event.startDate < next && event.endDateExclusive > first;
    const from = Date.parse(event.start), to = Date.parse(event.end);
    return to > from && from < endTime && to > startTime;
  });
  const count = new Date(`${next}T12:00:00Z`).setUTCDate(0);
  const length = new Date(count).getUTCDate();
  const keys = Array.from({ length }, (_, index) => shiftDayKey(first, index));
  const buckets = indexedDays && start && end ? indexedDays : indexCalendarDays(valid, keys, timezone);
  const days = keys.map((day, index) => ({
    key: day, day: index + 1, label: calendarDateLabel(day, { day: 'numeric', month: 'short', year: undefined }, timezone), count: buckets.get(day).length,
  }));
  return { days, events: valid, activeDays: days.filter(day => day.count > 0).length, peak: Math.max(0, ...days.map(day => day.count)) };
}

