import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardWork, taskIsOverdue } from '../src/utils/dashboardData.js';
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
