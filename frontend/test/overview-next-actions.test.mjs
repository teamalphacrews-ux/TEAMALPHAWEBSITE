import test from 'node:test';
import assert from 'node:assert/strict';
import { assignedOverviewAction, overviewNextActions } from '../src/utils/overviewNextActions.js';

const now = new Date('2026-11-22T10:00:00Z');
const timezone = 'America/Los_Angeles';
const rank = overview => overviewNextActions(overview, now, timezone);
const lead = (id, fields = {}) => ({ _id: id, name: id, status: 'New', ...fields });
const task = (id, fields = {}) => ({ _id: id, title: id, status: 'pending', ...fields });
const event = (title, start, end) => ({ _id: title, title, start, end });

test('prioritizes immediate events, missed deadlines, today, new enquiries and future work across modules', () => {
  const result = rank({
    actionQueue: [task('Undated'), task('Today', { dueDate: '2026-11-22T00:00:00.000Z' }), task('Late', { dueDate: '2026-11-19' })],
    upcomingEvents: [
      event('Tomorrow', '2026-11-23T10:00Z', '2026-11-23T11:00Z'),
      event('Soon', '2026-11-22T10:45Z', '2026-11-22T11:45Z'),
      event('Underway', '2026-11-22T09:00Z', '2026-11-22T12:00Z'),
    ],
    recentEnquiries: [lead('Maya'), lead('Rohan', { followUpDate: '2026-11-20', status: 'Meeting' })],
  });
  assert.deepEqual(result.map(a => a.timing), ['ongoing', 'soon', 'overdue', 'overdue', 'today', 'new', 'upcoming', 'undated']);
  assert.deepEqual(result.map(a => a.title), ['Underway', 'Soon', 'Late', 'Follow up with Rohan', 'Today', 'Review Maya’s enquiry', 'Tomorrow', 'Undated']);
});

test('opens exact records and keeps date-input deadlines on their selected calendar day', () => {
  const [enquiry, work, session] = rank({
    recentEnquiries: [lead('id&more', { followUpDate: '2026-11-22T00:00:00.000Z' })],
    actionQueue: [task('task + slash/', { dueDate: '2026-11-22' })],
    upcomingEvents: [event('event#1', '2026-11-24T08:00Z', '2026-11-24T09:00Z')],
  });
  assert.equal(enquiry.day, '2026-11-22');
  assert.equal(enquiry.timing, 'today');
  assert.equal(new URL(enquiry.to, 'https://example.test').searchParams.get('lead'), 'id&more');
  assert.equal(new URL(work.to, 'https://example.test').searchParams.get('task'), 'task + slash/');
  assert.equal(new URL(session.to, 'https://example.test').searchParams.get('event'), 'event#1');
});

test('omits ended or malformed events, closed enquiries, completed tasks and missing record IDs', () => {
  assert.deepEqual(rank({
    recentEnquiries: [lead('Converted', { status: 'Converted', followUpDate: '2026-11-20' }), lead('Archived', { status: 'Archived' }), lead('')],
    actionQueue: [task('done', { status: 'completed' }), task('')],
    upcomingEvents: [event('Ended', '2026-11-22T09:00Z', '2026-11-22T10:00Z'), event('Invalid', 'bad', '2026-11-22T11:00Z')],
  }), []);
  assert.deepEqual(rank(null), []);
  assert.deepEqual(rank({}), []);
});

test('includes older scheduled leads once and opens the exact invoice draft', () => {
  const repeated = lead('repeated', { followUpDate: '2026-11-22' });
  const result = rank({
    recentEnquiries: [repeated],
    scheduledFollowUps: [lead('older', { status: 'Meeting', followUpDate: '2026-11-20' }), repeated],
    draftInvoices: [{ _id: 'draft+id', clientName: 'Arun', documentNumber: 'INV-17', createdAt: '2026-11-21' }],
  });
  assert.deepEqual(result.map(action => action.title), ['Follow up with older', 'Follow up with repeated', 'Review the draft invoice for Arun']);
  assert.equal(result[2].to, '/admin/invoices/draft%2Bid');
});

test('all-day events respect the saved calendar dates and stay out of time-critical work', () => {
  const result = rank({ upcomingEvents: [
    { ...event('Shoot away', '2026-11-21T18:30Z', '2026-11-22T18:30Z'), allDay: true, startDate: '2026-11-22', endDateExclusive: '2026-11-23' },
  ] });
  assert.equal(result[0].timing, 'today');
  assert.equal(result[0].day, '2026-11-22');
});

test('restricted workspace entry uses only links already permitted to the account', () => {
  assert.equal(assignedOverviewAction([]), null);
  assert.equal(assignedOverviewAction([{ path: '/admin/invoices', name: 'Invoices' }]).label, 'Review invoices');
  assert.equal(assignedOverviewAction([{ path: '/admin/activity-log', name: 'Activity' }]).path, '/admin/activity-log');
});
