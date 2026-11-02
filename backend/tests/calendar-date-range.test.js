const test = require('node:test');
const assert = require('node:assert/strict');
const { googleDateRange, googleEventTimes, dateStart } = require('../utils/calendarDateRange');
const { eventFields } = require('../utils/studioCalendar');
const { linkedEventFields } = require('../utils/studioCalendar');

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

const eventIds = { first: '507f1f77bcf86cd799439011', second: '507f1f77bcf86cd799439012', contact: '507f1f77bcf86cd799439013', project: '507f1f77bcf86cd799439014' };
const timedEvent = { title: 'Wedding', start: '2028-01-20T03:30:00.000Z', end: '2028-01-20T06:30:00.000Z', teamMembers: [] };
test('calendar enquiry selection persists the resolved client and project alongside the same event', async () => {
  const value = await linkedEventFields({ ...timedEvent, lead: eventIds.first }, {}, async links => {
    assert.equal(links.lead, eventIds.first);
    links.contactId = eventIds.contact; links.studioProjectId = eventIds.project;
  });
  assert.equal(value.contactId, eventIds.contact); assert.equal(value.studioProjectId, eventIds.project);
  assert.equal(value.lead, eventIds.first); assert.equal(value.title, timedEvent.title);
});
test('changing or clearing an enquiry in partial calendar edits drops stale inferred associations without changing dates', async () => {
  const current = { ...timedEvent, lead: eventIds.first, contactId: eventIds.contact, studioProjectId: eventIds.project };
  const changed = await linkedEventFields({ lead: eventIds.second }, current, async links => {
    assert.equal(links.contactId, null); assert.equal(links.studioProjectId, null);
    links.contactId = eventIds.second; links.studioProjectId = eventIds.first;
  });
  assert.equal(changed.lead, eventIds.second); assert.equal(changed.start.toISOString(), current.start);
  assert.equal(changed.end.toISOString(), current.end); assert.equal(changed.title, current.title);
  const cleared = await linkedEventFields({ lead: null }, current, async () => {});
  assert.equal(cleared.lead, null); assert.equal(cleared.contactId, null); assert.equal(cleared.studioProjectId, null);
  const description = await linkedEventFields({ description: 'New notes' }, current, async () => {});
  assert.equal(description.lead, eventIds.first); assert.equal(description.studioProjectId, eventIds.project);
});
test('calendar rejects contradictory explicit enquiry and contact choices rather than silently replacing them', async () => {
  await assert.rejects(() => linkedEventFields({ ...timedEvent, lead: eventIds.first, contactId: eventIds.second }, {}, async links => {
    links.contactId = eventIds.contact; links.studioProjectId = eventIds.project;
  }), { status: 400 });
  await assert.rejects(() => linkedEventFields({ ...timedEvent, lead: eventIds.first, studioProjectId: eventIds.project }, {}, async links => {
    links.lead = eventIds.second;
  }), { status: 400 });
});
