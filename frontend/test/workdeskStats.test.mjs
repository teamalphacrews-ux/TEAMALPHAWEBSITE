import test from 'node:test';
import assert from 'node:assert/strict';
import { taskBreakdown, projectBreakdown, enquiryBreakdown, sessionBreakdown, workBuckets } from '../src/admin/components/overview/workdeskStats.js';

test('Overview distinguishes an empty response from unavailable work totals', () => {
  assert.equal(taskBreakdown(null), null);
  assert.deepEqual(taskBreakdown([]), [0, 0, 0, 0]);
  assert.deepEqual(taskBreakdown([
    { status: 'pending' },
    { status: 'pending', productionStage: 'Editing' },
    { status: 'pending', productionStage: 'In review' },
    { status: 'completed', productionStage: 'Editing' },
  ]), [1, 1, 1, 1]);
  assert.deepEqual(projectBreakdown(['Booked', 'Completed', 'Inquiry', 'Archived'].map(status => ({ status }))), [1, 1, 1]);
  assert.deepEqual(enquiryBreakdown([{ status: 'Archived', count: 3 }, { status: 'New', count: 1 }, { status: 'Converted', count: 2 }, { status: 'Meeting', count: 1 }]), [2, 1, 1]);
});

test('calendar totals use exclusive all-day boundaries and current timed sessions', () => {
  const events = [
    { allDay: true, startDate: '2026-11-22', endDateExclusive: '2026-11-23' },
    { allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-24' },
    { start: '2026-11-23T09:00:00Z', end: '2026-11-23T09:30:00Z' },
    { start: '2026-11-23T09:15:00Z', end: '2026-11-23T10:00:00Z' },
  ];
  assert.deepEqual(sessionBreakdown(events, Date.parse('2026-11-23T09:10:00Z'), '2026-11-23'), [1, 2, 1]);
});

test('workload respects studio dates across a year boundary and excludes completed or past tasks', () => {
  const tasks = [
    { dueDate: '2026-12-30', status: 'pending' },
    { dueDate: '2026-12-31T00:00:00.000Z', status: 'pending' },
    { dueDate: '2027-01-01', status: 'completed' },
    { dueDate: '2027-01-01', status: 'pending' },
    { status: 'pending' },
  ];
  // A UTC Jan 1 session takes place on Dec 31 in this studio.
  const events = [{ start: '2027-01-01T05:00:00Z' }];
  const results = period => workBuckets(tasks, events, period, '2026-12-31', 'America/Los_Angeles');
  assert.deepEqual(results('days').slice(0, 2).map(({ tasks, sessions }) => [tasks, sessions]), [[1, 1], [1, 0]]);
  assert.deepEqual(results('months').slice(0, 2).map(({ start, tasks, sessions }) => [start, tasks, sessions]), [['2026-12-01', 1, 1], ['2027-01-01', 1, 0]]);
  assert.deepEqual(results('weeks')[0], { start: '2026-12-28', end: '2027-01-04', tasks: 2, sessions: 1 });
});
