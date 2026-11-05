import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCrewSchedule } from '../src/admin/components/operations/crewSchedule.js';

const now = Date.parse('2026-10-16T00:00:00Z');
const crew = [{ _id: 'photographer', name: 'Anu Nair' }, { _id: 'filmmaker', name: 'Raj' }];
const event = (id, start, end, teamMembers = ['Anu Nair']) => ({
  _id: id,
  start: `2026-10-17T${start}:00Z`,
  end: `2026-10-17T${end}:00Z`,
  teamMembers,
});

test('matches calendar assignments by normalized crew names', () => {
  const result = deriveCrewSchedule(crew, [event('wedding', '09:00', '11:00', [' anu nair '])], now);
  assert.equal(result.assignments.get('photographer').length, 1);
  assert.equal(result.assignments.get('filmmaker').length, 0);
});

test('back-to-back bookings do not conflict at the shared boundary', () => {
  const result = deriveCrewSchedule(crew, [event('first', '09:00', '11:00'), event('next', '11:00', '12:00')], now);
  assert.equal(result.conflicts.length, 0);
});

test('overlapping bookings flag only the crew member assigned to both', () => {
  const result = deriveCrewSchedule(crew, [
    event('first', '09:00', '11:00'),
    event('overlap', '10:00', '12:00'),
    event('other-crew', '10:00', '12:00', ['Raj']),
  ], now);
  assert.deepEqual(result.conflicts.map(conflict => [conflict.member._id, conflict.first._id, conflict.second._id]), [
    ['photographer', 'first', 'overlap'],
  ]);
});

test('simultaneous bookings assigned to different crew do not conflict', () => {
  const result = deriveCrewSchedule(crew, [
    event('photos', '09:00', '11:00'),
    event('film', '09:00', '11:00', ['Raj']),
  ], now);
  assert.equal(result.conflicts.length, 0);
});

test('a long booking conflicts with each contained booking, even if those are separate', () => {
  const result = deriveCrewSchedule(crew, [
    event('afternoon', '12:00', '13:00'),
    event('all-day', '09:00', '17:00'),
    event('morning', '10:00', '11:00'),
  ], now);
  assert.deepEqual(result.conflicts.map(conflict => [conflict.first._id, conflict.second._id]), [
    ['all-day', 'morning'],
    ['all-day', 'afternoon'],
  ]);
});

test('excludes invalid, zero-duration, reversed and completed events', () => {
  const result = deriveCrewSchedule(crew, [
    event('valid', '09:00', '11:00'),
    event('reversed', '12:00', '11:00'),
    event('zero', '12:00', '12:00'),
    { _id: 'invalid', start: 'not-a-date', end: 'not-a-date', teamMembers: ['Anu Nair'] },
    { _id: 'past', start: '2026-10-15T09:00:00Z', end: '2026-10-15T11:00:00Z', teamMembers: ['Anu Nair'] },
    { _id: 'ended-now', start: '2026-10-15T09:00:00Z', end: '2026-10-16T00:00:00Z', teamMembers: ['Anu Nair'] },
  ], now);
  assert.deepEqual(result.upcomingEvents.map(item => item._id), ['valid']);
  assert.equal(result.conflicts.length, 0);
});

test('includes ongoing assignments until their end time', () => {
  const result = deriveCrewSchedule(crew, [{
    _id: 'ongoing', start: '2026-10-15T23:00:00Z', end: '2026-10-16T01:00:00Z', teamMembers: ['Anu Nair'],
  }], now);
  assert.equal(result.upcomingEvents.length, 1);
  assert.equal(result.assignments.get('photographer').length, 1);
});
