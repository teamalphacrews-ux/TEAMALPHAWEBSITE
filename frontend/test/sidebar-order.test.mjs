import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { moveSidebarItem, sortSidebarItems } from '../src/utils/sidebarOrder.js';
import { normalizeOverviewPreferences } from '../src/utils/overviewPreferences.js';

const { parsePreferences } = createRequire(import.meta.url)('../../backend/utils/studioPreferences');
const projects = { name: 'Projects', path: '/admin/studio-projects' };
const enquiries = { name: 'Enquiries', path: '/admin/crm' };
const calendar = { name: 'Calendar', path: '/admin/calendar' };
const section = [projects, enquiries, calendar];

test('default, localized alphabetical and custom sorts preserve the authorized item set', () => {
  const order = ['/admin/users', calendar.path, '/admin/retired'];
  assert.deepEqual(sortSidebarItems(section, 'default', order), section);
  assert.deepEqual(sortSidebarItems(section, 'alphabetical', order, 'en'), [calendar, enquiries, projects]);
  const translated = [projects, enquiries, calendar].sort((a, b) => {
    const names = { Projects: 'प्रोजेक्ट', Calendar: 'कैलेंडर', Enquiries: 'पूछताछ' };
    return names[a.name].localeCompare(names[b.name], 'hi');
  });
  assert.deepEqual(sortSidebarItems(section, 'alphabetical', order, 'hi'), translated);
  assert.deepEqual(sortSidebarItems(section, 'custom', order), [calendar, projects, enquiries]);
  assert.deepEqual(section, [projects, enquiries, calendar]);
});

test('moving an item updates only the visible section and retains unsorted new pages', () => {
  const hidden = '/admin/finance', outside = '/admin/email';
  const order = [projects.path, outside, hidden, enquiries.path];
  const moved = moveSidebarItem(order, section, enquiries.path, -1);
  assert.deepEqual(moved, [enquiries.path, outside, hidden, projects.path, calendar.path]);
  assert.deepEqual(sortSidebarItems(section, 'custom', moved), [enquiries, projects, calendar]);
  assert.deepEqual(moveSidebarItem([], section, projects.path, 1), [enquiries.path, projects.path, calendar.path]);
  for (const [path, delta] of [[hidden, -1], [projects.path, -1], [calendar.path, 1], [calendar.path, -2]]) {
    assert.deepEqual(moveSidebarItem(order, section, path, delta), order);
  }
});

test('saved sorts round trip and legacy or invalid cached values use safe defaults', () => {
  const patch = { sidebarSort: 'custom', sidebarOrder: [calendar.path, projects.path] };
  const restored = normalizeOverviewPreferences(JSON.parse(JSON.stringify(parsePreferences(patch))));
  assert.equal(restored.sidebarSort, 'custom');
  assert.deepEqual(restored.sidebarOrder, patch.sidebarOrder);
  assert.equal(normalizeOverviewPreferences({}).sidebarSort, 'default');
  assert.deepEqual(normalizeOverviewPreferences({ sidebarOrder: [calendar.path, 'https://example.com', calendar.path] }).sidebarOrder, [calendar.path]);
  for (const invalid of [{ sidebarSort: 'random' }, { sidebarOrder: [calendar.path, calendar.path] }, { sidebarOrder: [null] }, { sidebarOrder: ['//example.com'] }, { sidebarOrder: Array.from({ length: 65 }, (_, i) => '/admin/item-' + i) }]) {
    assert.throws(() => parsePreferences(invalid), { status: 400 });
  }
});
