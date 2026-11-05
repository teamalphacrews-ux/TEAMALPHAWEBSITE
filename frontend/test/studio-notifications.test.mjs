import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNewNotifications, notificationAlertAllowed, notificationCategory, notificationIsSelected, notificationQuietNow, notificationTimezone, notificationVolume, playNotificationSound } from '../src/utils/studioNotifications.js';

test('initial snapshots, read notifications and repeated polls never become new alerts', () => {
  const first = collectNewNotifications([{ _id: 'old', type: 'Lead' }], null);
  assert.deepEqual(first.fresh, []);
  const second = collectNewNotifications([{ _id: 'old', type: 'Lead' }, { _id: 'new', type: 'Chat' }, { _id: 'read', isRead: true }], first.seen);
  assert.deepEqual(second.fresh.map(item => item._id), ['new']);
  assert.deepEqual(collectNewNotifications([{ _id: 'new' }, { _id: 'read', isRead: false }], second.seen).fresh, []);
  assert.deepEqual(collectNewNotifications(null, second.seen).fresh, []);
});

test('notification selection maps stored API categories without hiding unknown studio updates', () => {
  for (const [type, category] of Object.entries({ Lead: 'enquiries', Event: 'calendar', Task: 'tasks', Gallery: 'tasks', Invoice: 'finance', Finance: 'finance', Chat: 'messages', Message: 'messages', System: 'system', FutureType: 'system' })) assert.equal(notificationCategory({ type }), category);
  const lead = { _id: 'one', type: 'Lead' };
  assert.equal(notificationIsSelected(lead, {}), true);
  assert.equal(notificationIsSelected(lead, { notificationCategories: [] }), false);
  assert.equal(notificationAlertAllowed(lead, { notificationCategories: ['calendar'] }), false);
  assert.equal(notificationAlertAllowed(lead, { notificationCategories: ['enquiries'] }), true);
  assert.equal(notificationAlertAllowed({ ...lead, isRead: true }, {}), false);
  assert.equal(notificationCategory({ type: 'System', link: '/admin/quotations?quote=123' }), 'finance');
  assert.equal(notificationCategory({ type: 'System', link: '/admin/chats' }), 'messages');
  assert.equal(notificationCategory({ type: 'System', link: '/admin' }), 'system');
});

test('overnight quiet hours respect the studio timezone and exact start/end boundaries', () => {
  const preferences = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00', timezone: 'studio' };
  assert.equal(notificationQuietNow(preferences, '2026-10-26T16:29:00Z', 'Asia/Kolkata'), false);
  assert.equal(notificationQuietNow(preferences, '2026-10-26T16:30:00Z', 'Asia/Kolkata'), true);
  assert.equal(notificationQuietNow(preferences, '2026-10-27T02:29:00Z', 'Asia/Kolkata'), true);
  assert.equal(notificationQuietNow(preferences, '2026-10-27T02:30:00Z', 'Asia/Kolkata'), false);
  assert.equal(notificationAlertAllowed({ _id: 'new', type: 'Finance' }, preferences, '2026-10-26T17:00:00Z', 'Asia/Kolkata'), false);
  assert.equal(notificationQuietNow({ ...preferences, timezone: 'Europe/London' }, '2026-10-26T17:00:00Z', 'Asia/Kolkata'), false);
});

test('daytime and all-day quiet hours work and invalid saved values fail safely', () => {
  const preferences = { quietHoursEnabled: true, quietHoursStart: '09:00', quietHoursEnd: '17:00', timezone: 'UTC' };
  assert.equal(notificationQuietNow(preferences, '2026-10-26T10:00:00Z'), true);
  assert.equal(notificationQuietNow(preferences, '2026-10-26T17:00:00Z'), false);
  assert.equal(notificationQuietNow({ ...preferences, quietHoursStart: '17:00' }, '2026-10-26T23:00:00Z'), true);
  assert.equal(notificationQuietNow({ ...preferences, quietHoursEnabled: false }, '2026-10-26T10:00:00Z'), false);
  assert.equal(notificationQuietNow({ ...preferences, quietHoursStart: '25:00' }, '2026-10-26T10:00:00Z'), false);
  assert.equal(notificationQuietNow(preferences, 'not-a-date'), false);
  assert.equal(notificationTimezone({ timezone: 'not/a/timezone' }), 'Asia/Kolkata');
});

test('notification volume is bounded and automatic sounds cannot start an audio context', async () => {
  assert.equal(notificationVolume(-10), 0);
  assert.equal(notificationVolume(120), 100);
  assert.equal(notificationVolume(NaN), 50);
  assert.equal(notificationVolume(35), 35);
  assert.equal(await playNotificationSound('chime', 0), false);
  assert.equal(await playNotificationSound('chime', 50), false);
});
