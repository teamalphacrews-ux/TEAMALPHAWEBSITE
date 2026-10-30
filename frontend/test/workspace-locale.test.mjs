import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWorkspaceDate, formatWorkspaceTime, formatWorkspaceNumber, resolveWorkspaceTimezone, workspaceLocale } from '../src/utils/workspaceLocale.js';

test('date formats and date-only values keep their intended calendar day across regions', () => {
  assert.equal(formatWorkspaceDate('2026-12-18', { timezone: 'America/Los_Angeles' }), '18/12/2026');
  assert.equal(formatWorkspaceDate('2026-12-18', { dateFormat: 'month-first' }), '12/18/2026');
  assert.equal(formatWorkspaceDate('2026-12-18', { dateFormat: 'iso' }), '2026-12-18');
  assert.equal(formatWorkspaceDate('2026-02-30', {}), 'Not set');
  assert.equal(formatWorkspaceDate(null, {}), 'Not set');
});
test('personal zones respect studio fallback and 24-hour midnight never becomes 24:00', () => {
  assert.equal(resolveWorkspaceTimezone({ timezone: 'studio' }, 'Asia/Dubai'), 'Asia/Dubai');
  assert.equal(resolveWorkspaceTimezone({ timezone: 'invalid' }, 'Asia/Dubai'), 'Asia/Kolkata');
  assert.equal(formatWorkspaceTime('2026-12-18T18:30:00Z', { timeFormat: '24h' }), '00:00');
  assert.equal(formatWorkspaceTime('2026-12-18T09:00:00Z', { timeFormat: '24h' }), '14:30');
});
test('number formatting preserves standard digits, negative values and document currency', () => {
  assert.equal(formatWorkspaceNumber(1234567.89, {}), '12,34,567.89');
  assert.equal(formatWorkspaceNumber(-1234567.89, { numberFormat: 'international' }), '-1,234,567.89');
  assert.equal(formatWorkspaceNumber(0, { language: 'hi' }), '0');
  assert.equal(formatWorkspaceNumber(null, {}), '—');
  assert.equal(workspaceLocale({ language: 'kn', region: 'IN' }), 'kn-IN-u-nu-latn');
  assert.equal(workspaceLocale({ language: 'unsafe', region: 'unsafe' }), 'en-IN-u-nu-latn');
});
