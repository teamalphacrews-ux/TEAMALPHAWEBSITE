import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDestination, safeStudioReturn } from '../src/utils/studioNavigation.js';
test('record links retain identity and an internal return path', () => {
  const link = new URL(recordDestination('enquiry', 'record &1', '/admin?tab=work'), 'https://studio.test');
  assert.equal(link.pathname, '/admin/crm'); assert.equal(link.searchParams.get('lead'), 'record &1'); assert.equal(link.searchParams.get('returnTo'), '/admin?tab=work');
  assert.equal(new URL(recordDestination('event', 'e1'), 'https://studio.test').searchParams.get('event'), 'e1');
});
test('external, protocol-relative and malformed return destinations fall back inside the workspace', () => {
  for (const input of ['https://evil.test', '//evil.test', '/administrator', '/admin\\evil', '/admin\n/else', '/auth', null]) assert.equal(safeStudioReturn(input), '/admin');
  assert.equal(safeStudioReturn('/admin/calendar?event=e1'), '/admin/calendar?event=e1');
});
