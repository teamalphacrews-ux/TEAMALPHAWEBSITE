import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCalendarSession, nextProductionTask } from '../src/admin/components/operations/nextScheduledWork.js';

test('task guidance uses the earliest real pending deadline within the provided view', () => {
  const done = { _id: 'complete', status: 'completed', dueDate: '2026-01-01' };
  const undated = { _id: 'undated' };
  const first = { _id: 'first', dueDate: '2026-11-20' };
  const later = { _id: 'later', dueDate: '2026-11-24' };
  assert.equal(nextProductionTask([done, undated, later, first]), first);
  assert.equal(nextProductionTask([done, undated]), undated);
  assert.equal(nextProductionTask([done, { title: 'Unopenable' }]), undefined);
});

test('calendar guidance keeps a current session until its exclusive end and skips invalid times', () => {
  const current = { _id: '1', start: '2026-11-22T08:00Z', end: '2026-11-22T09:00Z' };
  const next = { _id: '2', start: '2026-11-22T09:00Z', end: '2026-11-22T10:00Z' };
  const broken = { _id: '3', start: 'bad', end: next.end };
  const records = [broken, next, current];
  assert.equal(nextCalendarSession(records, Date.parse(current.start), 'UTC'), current);
  assert.equal(nextCalendarSession(records, Date.parse(current.end), 'UTC'), next);
  assert.equal(nextCalendarSession(records, Date.parse(next.end), 'UTC'), undefined);
});

test('all-day event guidance follows calendar dates in the studio timezone', () => {
  const day = { _id: 'day', allDay: true, startDate: '2026-11-23', endDateExclusive: '2026-11-24' };
  assert.equal(nextCalendarSession([day], Date.parse('2026-11-23T18:29Z'), 'Asia/Kolkata'), day);
  assert.equal(nextCalendarSession([day], Date.parse('2026-11-23T18:30Z'), 'Asia/Kolkata'), undefined);
});
