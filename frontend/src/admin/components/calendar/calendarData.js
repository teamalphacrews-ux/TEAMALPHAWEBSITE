import { DEFAULT_STUDIO_TIMEZONE, eventOnStudioDay, hasAllDayRange, formatStudioDate, shiftDayKey, studioDayBounds, studioDayKey } from '../../../utils/studioTime.js';

const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value));
export const calendarMonthKey = (value, timezone = DEFAULT_STUDIO_TIMEZONE) => validMonth(value) ? value : studioDayKey(value, timezone).slice(0, 7);
export const calendarDateLabel = (key, options = {}, timezone = DEFAULT_STUDIO_TIMEZONE) => {
  const { start } = studioDayBounds(key, timezone);
  return start ? formatStudioDate(start, options, timezone) : 'Date not set';
};

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

export function calendarMonthLoad(events = [], month, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const key = calendarMonthKey(month, timezone);
  if (!validMonth(key)) return { days: [], events: [], activeDays: 0, peak: 0 };
  const first = `${key}-01`;
  const next = `${shiftCalendarMonth(key, 1)}-01`;
  const { start } = studioDayBounds(first, timezone);
  const { start: end } = studioDayBounds(next, timezone);
  const valid = events.filter(event => {
    if (hasAllDayRange(event)) return event.startDate < next && event.endDateExclusive > first;
    const from = Date.parse(event.start), to = Date.parse(event.end);
    return Number.isFinite(from) && Number.isFinite(to) && to > from && from < Date.parse(end) && to > Date.parse(start);
  });
  const count = new Date(`${next}T12:00:00Z`).setUTCDate(0);
  const length = new Date(count).getUTCDate();
  const days = Array.from({ length }, (_, index) => {
    const day = shiftDayKey(first, index);
    return { key: day, day: index + 1, label: calendarDateLabel(day, { day: 'numeric', month: 'short', year: undefined }, timezone), count: valid.filter(event => eventOnStudioDay(event, day, timezone)).length };
  });
  return { days, events: valid, activeDays: days.filter(day => day.count > 0).length, peak: Math.max(0, ...days.map(day => day.count)) };
}

