import test from 'node:test';
import assert from 'node:assert/strict';
import { eventOnStudioDay, formatStudioTime, studioDateTimeInput, studioDateTimeToISO, studioDayBounds, studioDayKey, studioTimezone } from '../src/utils/studioTime.js';
import { calendarMonthGrid, calendarMonthLoad, shiftCalendarMonth } from '../src/admin/components/calendar/calendarData.js';

test('studio dates and input times are independent of the viewing device timezone', () => {
  const instant = '2026-10-24T20:00:00.000Z';
  assert.equal(studioDayKey(instant, 'Asia/Kolkata'), '2026-10-25');
  assert.equal(studioDateTimeInput(instant, 'Asia/Kolkata'), '2026-10-25T01:30');
  assert.equal(studioDateTimeToISO('2026-10-25T10:00', 'Asia/Kolkata'), '2026-10-25T04:30:00.000Z');
  assert.match(formatStudioTime(instant, 'Asia/Kolkata'), /1:30/);
  assert.equal(studioTimezone('Bad/Timezone'), 'Asia/Kolkata');
  assert.equal(studioDayKey(null, 'Asia/Kolkata'), '');
  assert.equal(studioDateTimeInput('invalid', 'Asia/Kolkata'), '');
});

test('event edits retain the same instant and reject nonexistent or invalid wall times', () => {
  const instant = '2026-10-25T04:45:00.000Z';
  assert.equal(studioDateTimeToISO(studioDateTimeInput(instant, 'Asia/Kolkata'), 'Asia/Kolkata'), instant);
  assert.equal(studioDateTimeToISO('2026-02-30T10:00', 'Asia/Kolkata'), null);
  assert.equal(studioDateTimeToISO('2026-03-08T02:30', 'America/New_York'), null);
  assert.equal(studioDateTimeToISO('2026-11-01T01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
});

test('studio day boundaries use the configured zone and exclude events ending at midnight', () => {
  assert.deepEqual(studioDayBounds('2026-10-25', 'Asia/Kolkata'), { start: '2026-10-24T18:30:00.000Z', end: '2026-10-25T18:30:00.000Z' });
  const event = { start: '2026-10-24T17:30:00Z', end: '2026-10-24T18:30:00Z' };
  assert.equal(eventOnStudioDay(event, '2026-10-24', 'Asia/Kolkata'), true);
  assert.equal(eventOnStudioDay(event, '2026-10-25', 'Asia/Kolkata'), false);
  const dstDay = studioDayBounds('2026-03-08', 'America/New_York');
  assert.equal((Date.parse(dstDay.end) - Date.parse(dstDay.start)) / 3600000, 23);
});

test('month workload and selected-day agenda share boundaries for cross-midnight and multi-day events', () => {
  const events = [
    { _id: 'before', start: '2026-09-30T10:00:00Z', end: '2026-09-30T18:30:00Z' },
    { _id: 'cross', start: '2026-09-30T18:00:00Z', end: '2026-09-30T20:00:00Z' },
    { _id: 'multi', start: '2026-10-01T04:30:00Z', end: '2026-10-02T18:30:00Z' },
    { _id: 'next', start: '2026-10-31T18:30:00Z', end: '2026-10-31T19:30:00Z' },
  ];
  const result = calendarMonthLoad(events, '2026-10', 'Asia/Kolkata');
  assert.deepEqual(result.events.map(event => event._id), ['cross', 'multi']);
  assert.deepEqual(result.days.slice(0, 3).map(day => day.count), [2, 1, 0]);
  assert.deepEqual(events.filter(event => eventOnStudioDay(event, '2026-10-01', 'Asia/Kolkata')).map(event => event._id), ['cross', 'multi']);
  assert.equal(calendarMonthGrid('2026-10')[0], '2026-09-28');
  assert.equal(calendarMonthGrid('2026-10').length, 42);
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(calendarMonthLoad([], '2028-02').days.length, 29);
  assert.deepEqual(calendarMonthLoad([], 'invalid'), { days: [], events: [], activeDays: 0, peak: 0 });
  assert.deepEqual(calendarMonthGrid('2026-13'), []);
});
