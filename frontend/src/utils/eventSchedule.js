import { DEFAULT_STUDIO_TIMEZONE, eventStartDay, formatStudioDate, formatStudioTime, hasAllDayRange, shiftDayKey, studioDayBounds, studioDayKey } from './studioTime.js';

// All-day ends are exclusive. Timed events retain the actual end instant,
// including a midnight finish on the following calendar day.
export function eventScheduleRange(event, timezone = DEFAULT_STUDIO_TIMEZONE) {
  const startDay = eventStartDay(event, timezone);
  const end = Date.parse(event?.end);
  const endDay = hasAllDayRange(event)
    ? shiftDayKey(event.endDateExclusive, -1)
    : event?.allDay === true && Number.isFinite(end)
      ? studioDayKey(end - 1, timezone)
      : studioDayKey(event?.end, timezone);
  return { startDay, endDay: endDay || startDay, multiDay: !!startDay && !!endDay && endDay > startDay };
}

export function eventScheduleLabel(event, timezone = DEFAULT_STUDIO_TIMEZONE, formatters = {}) {
  const { startDay, endDay, multiDay } = eventScheduleRange(event, timezone);
  const date = formatters.date || ((key, options) => formatStudioDate(studioDayBounds(key, timezone).start, options, timezone));
  const time = formatters.time || (value => formatStudioTime(value, timezone));
  const dateOptions = { day: 'numeric', month: 'short', year: startDay.slice(0, 4) === endDay.slice(0, 4) ? undefined : 'numeric' };
  if (event?.allDay === true) return multiDay ? `${date(startDay, dateOptions)} – ${date(endDay, dateOptions)} · All day` : 'All day';
  if (multiDay) return `${date(startDay, dateOptions)}, ${time(event.start)} – ${date(endDay, dateOptions)}, ${time(event.end)}`;
  return `${time(event?.start)} – ${time(event?.end)}`;
}
