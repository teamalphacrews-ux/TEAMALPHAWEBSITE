import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardWork, taskIsOverdue } from '../src/utils/dashboardData.js';
import { eventOnStudioDay } from '../src/utils/studioTime.js';
const now = new Date('2026-10-24T20:00:00Z'); // 25 October in Bengaluru.
test('urgent work sorts before future and undated tasks; today is not overdue', () => {
  const tasks = [{ title: 'undated' }, { title: 'later', dueDate: '2026-10-29' }, { title: 'today', dueDate: '2026-10-25' }, { title: 'oldest', dueDate: '2026-10-20' }, { title: 'done', dueDate: '2026-10-01', status: 'completed' }, { title: 'yesterday', dueDate: '2026-10-24' }];
  assert.deepEqual(dashboardWork([], tasks, now).tasks.map(task => task.title), ['oldest', 'yesterday', 'today', 'later', 'undated']);
  assert.equal(taskIsOverdue(tasks[2], now), false); assert.equal(taskIsOverdue({ dueDate: 'invalid' }, now), false);
  assert.equal(dashboardWork([], tasks, now).overdueTasks, 2);
  assert.equal(tasks[0].title, 'undated');
});
test('ongoing and today events precede later dates, excluding finished and malformed events', () => {
  const events = [{ _id: 'future', start: '2026-10-27T05:00Z', end: '2026-10-27T06:00Z' }, { _id: 'today', start: '2026-10-25T01:00Z', end: '2026-10-25T02:00Z' }, { _id: 'ongoing', start: '2026-10-24T19:00Z', end: '2026-10-24T21:00Z' }, { _id: 'finished', start: '2026-10-24T10:00Z', end: '2026-10-24T11:00Z' }, { _id: 'bad', start: 'invalid', end: 'invalid' }];
  const result = dashboardWork(events, [], now);
  assert.deepEqual(result.events.map(event => event._id), ['ongoing', 'today', 'future']); assert.equal(result.todayEvents, 2);
});

test('today work counts events remaining today while the day schedule retains finished events', () => {
  const now = new Date('2026-11-03T13:30:00Z'); // 19:00 in the studio.
  const finished = { _id: 'finished-today', start: '2026-11-03T04:30:00Z', end: '2026-11-03T12:30:00Z' };
  const ongoing = { _id: 'ongoing', start: '2026-11-03T12:30:00Z', end: '2026-11-03T14:30:00Z' };
  assert.equal(eventOnStudioDay(finished, '2026-11-03', 'Asia/Kolkata'), true);
  assert.equal(dashboardWork([finished], [], now).todayEvents, 0);
  assert.equal(dashboardWork([finished, ongoing], [], now).todayEvents, 1);
});

test('remaining work respects the studio day rather than the UTC or browser date', () => {
  const now = new Date('2026-11-03T01:00:00Z');
  const events = [{ start: '2026-11-03T17:00:00Z', end: '2026-11-03T18:00:00Z' }];
  assert.equal(dashboardWork(events, [], now, 'Asia/Kolkata').todayEvents, 1);
  assert.equal(dashboardWork(events, [], now, 'America/Los_Angeles').todayEvents, 0);
});

test('midnight event boundaries belong only to the day they overlap', () => {
  const events = [
    { _id: 'ended-at-midnight', start: '2026-11-02T17:30:00Z', end: '2026-11-02T18:30:00Z' },
    { _id: 'overnight', start: '2026-11-02T18:00:00Z', end: '2026-11-02T19:30:00Z' },
    { _id: 'tomorrow', start: '2026-11-03T18:30:00Z', end: '2026-11-03T19:30:00Z' },
  ];
  const result = dashboardWork(events, [], new Date('2026-11-02T18:30:00Z'));
  assert.deepEqual(result.events.map(event => event._id), ['overnight', 'tomorrow']);
  assert.equal(result.todayEvents, 1);
});

test('all-day work remains through the full 25-hour studio day and ends exclusively', () => {
  const event = { allDay: true, startDate: '2026-11-01', endDateExclusive: '2026-11-02', start: '2026-11-01T04:00:00Z', end: '2026-11-02T05:00:00Z' };
  assert.equal(dashboardWork([event], [], new Date('2026-11-02T04:30:00Z'), 'America/New_York').todayEvents, 1);
  assert.equal(dashboardWork([event], [], new Date('2026-11-02T05:00:00Z'), 'America/New_York').todayEvents, 0);
});
