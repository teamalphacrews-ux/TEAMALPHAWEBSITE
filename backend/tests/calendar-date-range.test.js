const test = require('node:test');
const assert = require('node:assert/strict');
const { googleDateRange, googleEventTimes, dateStart } = require('../utils/calendarDateRange');
const { eventFields } = require('../utils/studioCalendar');

test('Google date-only events preserve exclusive calendar dates and studio midnight', () => {
  const value = googleDateRange({ start: { date: '2026-11-05' }, end: { date: '2026-11-07' } }, 'Asia/Kolkata');
  assert.equal(value.allDay, true);
  assert.equal(value.startDate, '2026-11-05');
  assert.equal(value.endDateExclusive, '2026-11-07');
  assert.equal(value.start.toISOString(), '2026-11-04T18:30:00.000Z');
  assert.equal(value.end.toISOString(), '2026-11-06T18:30:00.000Z');
  assert.deepEqual(googleEventTimes(value), { start: { date: '2026-11-05' }, end: { date: '2026-11-07' } });
});

test('timed midnight events stay timed and invalid Google ranges are rejected', () => {
  const value = googleDateRange({ start: { dateTime: '2026-11-05T00:00:00Z' }, end: { dateTime: '2026-11-05T01:00:00Z' } });
  assert.equal(value.allDay, false);
  assert.equal(googleEventTimes(value).start.dateTime, '2026-11-05T00:00:00.000Z');
  assert.throws(() => googleDateRange({ start: { date: '2026-02-30' }, end: { date: '2026-03-02' } }));
  assert.throws(() => googleDateRange({ start: { date: '2026-11-07' }, end: { date: '2026-11-05' } }));
});

test('date boundaries handle DST days without a fixed 24-hour assumption', () => {
  assert.equal((dateStart('2026-03-09', 'America/New_York') - dateStart('2026-03-08', 'America/New_York')) / 3600000, 23);
  assert.equal((dateStart('2026-11-02', 'America/New_York') - dateStart('2026-11-01', 'America/New_York')) / 3600000, 25);
});

test('calendar writes validate all-day metadata and clear it when changing to timed', () => {
  const value = eventFields({ title: 'Wedding', allDay: true, startDate: '2026-11-05', endDateExclusive: '2026-11-07', dateTimezone: 'Asia/Kolkata', teamMembers: [] });
  assert.equal(value.start.toISOString(), '2026-11-04T18:30:00.000Z');
  assert.throws(() => eventFields({ ...value, endDateExclusive: '2026-11-05' }), { status: 400 });
  assert.throws(() => eventFields({ ...value, dateTimezone: 'invalid' }), { status: 400 });
  const timed = eventFields({ allDay: false }, value);
  assert.equal(timed.startDate, '');
  assert.equal(timed.endDateExclusive, '');
});
