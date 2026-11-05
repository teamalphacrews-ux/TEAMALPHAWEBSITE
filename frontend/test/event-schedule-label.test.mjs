import test from 'node:test';
import assert from 'node:assert/strict';
import { eventScheduleLabel, eventScheduleRange } from '../src/utils/eventSchedule.js';

const zone = 'Asia/Kolkata';
const plain = { date: (key, options) => options.year ? key : key.slice(5), time: value => value.slice(11, 16) };

test('same studio day stays compact even when UTC dates differ', () => {
  const event = { start: '2026-10-15T23:00:00Z', end: '2026-10-16T03:00:00Z' };
  assert.equal(eventScheduleRange(event, zone).multiDay, false);
  assert.equal(eventScheduleLabel(event, zone, plain), '23:00 – 03:00');
});

test('multi-day timed assignments name both studio dates, including a midnight end', () => {
  const event = { start: '2026-10-16T16:00:00Z', end: '2026-10-17T18:30:00Z' };
  assert.deepEqual(eventScheduleRange(event, zone), { startDay: '2026-10-16', endDay: '2026-10-18', multiDay: true });
  assert.equal(eventScheduleLabel(event, zone, plain), '10-16, 16:00 – 10-18, 18:30');
  assert.match(eventScheduleLabel(event, zone), /16 Oct, .*18 Oct,/);
});

test('all-day date ranges display the last included day rather than the exclusive end', () => {
  const event = { allDay: true, startDate: '2026-10-30', endDateExclusive: '2026-11-02' };
  assert.deepEqual(eventScheduleRange(event, 'America/Los_Angeles'), { startDay: '2026-10-30', endDay: '2026-11-01', multiDay: true });
  assert.equal(eventScheduleLabel(event, zone, plain), '10-30 – 11-01 · All day');
  assert.equal(eventScheduleLabel({ ...event, endDateExclusive: '2026-10-31' }, zone), 'All day');
});

test('legacy all-day instants use exclusive end semantics across daylight saving', () => {
  const event = { allDay: true, start: '2026-03-07T08:00:00Z', end: '2026-03-10T07:00:00Z' };
  assert.deepEqual(eventScheduleRange(event, 'America/Los_Angeles'), { startDay: '2026-03-07', endDay: '2026-03-09', multiDay: true });
});

test('ranges spanning years retain both years', () => {
  const event = { allDay: true, startDate: '2026-12-31', endDateExclusive: '2027-01-03' };
  assert.equal(eventScheduleLabel(event, zone, plain), '2026-12-31 – 2027-01-02 · All day');
});
