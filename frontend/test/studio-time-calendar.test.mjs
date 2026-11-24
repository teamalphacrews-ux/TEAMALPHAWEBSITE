import test from 'node:test';
import assert from 'node:assert/strict';
import { eventOnStudioDay, formatStudioTime, studioDateTimeInput, studioDateTimeToISO, studioDayBounds, studioDayKey, studioTimezone } from '../src/utils/studioTime.js';
import { calendarCreationRequest, calendarMonthGrid, calendarMonthLoad, indexCalendarDays, shiftCalendarMonth } from '../src/admin/components/calendar/calendarData.js';

test('indexed calendar tiles match daily agendas across DST and adjacent months in source order', () => {
  const records = [
    { start: '2026-10-25T23:00:00Z', end: '2026-11-12T00:00:00Z' },
    { allDay: true, startDate: '2026-10-30', endDateExclusive: '2026-11-03' },
    { start: '2026-11-01T04:00:00Z', end: '2026-11-02T05:00:00Z' },
    { start: 'invalid', end: '2026-11-01T00:00:00Z' },
    { start: '2026-11-01T01:00:00Z', end: '2026-11-01T00:00:00Z' },
  ];
  const days = calendarMonthGrid('2026-11');
  for (const zone of ['America/New_York', 'Asia/Kolkata']) {
    const index = indexCalendarDays(records, days, zone);
    for (const day of days) {
      assert.deepEqual(index.get(day), records.filter(event => eventOnStudioDay(event, day, zone)));
    }
    assert.deepEqual(calendarMonthLoad(records, '2026-11', zone, index), calendarMonthLoad(records, '2026-11', zone));
  }
});

test('switching between projects for the same contact starts a fresh calendar editor with the requested project', () => {
  const options = { day: '2026-11-22', timezone: 'Asia/Kolkata', leads: [
    { _id: 'first-enquiry', studioProjectId: 'first' }, { _id: 'second-enquiry', studioProjectId: 'second' },
  ] };
  const first = calendarCreationRequest(new URLSearchParams('new=1&contact=client&project=first'), options);
  const second = calendarCreationRequest(new URLSearchParams('new=1&contact=client&project=second'), options);
  assert.notEqual(first.key, second.key);
  assert.equal(first.event.lead, 'first-enquiry');
  assert.equal(second.event.lead, 'second-enquiry');
  assert.equal(second.event.studioProjectId, 'second');
  assert.equal(second.event.contactId, 'client');
});

test('calendar project drafts mount after the first lookup and retain their editor identity across refreshes', () => {
  const params = new URLSearchParams('new=1&project=first');
  const initial = { day: '2026-11-22', timezone: 'Asia/Kolkata', loading: true };
  assert.equal(calendarCreationRequest(params, initial), null);
  const loaded = { ...initial, loading: false, leads: [] };
  const first = calendarCreationRequest(params, loaded);
  assert.equal(calendarCreationRequest(params, { ...loaded, loading: true }).key, first.key);
  const refreshed = { ...loaded, leads: [{ _id: 'newly-linked', studioProjectId: 'first' }], timezone: 'UTC' };
  assert.equal(calendarCreationRequest(params, refreshed).key, first.key);
  assert.notEqual(calendarCreationRequest(new URLSearchParams('new=1&project=second'), refreshed).key, first.key);
});

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

test('all-day events stay on authored dates without spilling into another day in any viewing zone', () => {
  const event = { allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-07', start: '2026-11-04T18:30:00Z', end: '2026-11-06T18:30:00Z' };
  for (const zone of ['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland']) {
    assert.equal(eventOnStudioDay(event, '2026-11-04', zone), false);
    assert.equal(eventOnStudioDay(event, '2026-11-05', zone), true);
    assert.equal(eventOnStudioDay(event, '2026-11-06', zone), true);
    assert.equal(eventOnStudioDay(event, '2026-11-07', zone), false);
    const result = calendarMonthLoad([event], '2026-11', zone);
    assert.equal(result.activeDays, 2);
    assert.equal(result.days[4].count, 1);
    assert.equal(result.days[6].count, 0);
  }
});
test('all-day month boundaries use dates even when instants cross the viewing month', () => {
  const event = { allDay: true, startDate: '2026-11-01', endDateExclusive: '2026-11-02', start: '2026-10-31T18:30:00Z', end: '2026-11-01T18:30:00Z' };
  assert.equal(calendarMonthLoad([event], '2026-10', 'America/Los_Angeles').events.length, 0);
  assert.equal(calendarMonthLoad([event], '2026-11', 'America/Los_Angeles').events.length, 1);
});
