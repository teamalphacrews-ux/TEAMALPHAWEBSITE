import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_IDEAS, nextOverviewIdea } from '../src/utils/overviewInspiration.js';

test('successive refreshes cover the library before repeating', () => {
  let previous;
  const seen = new Set();
  for (let i = 0; i < OVERVIEW_IDEAS.length; i++) {
    const idea = nextOverviewIdea(previous);
    assert.notEqual(idea.id, previous);
    assert.ok(!seen.has(idea.id));
    seen.add(idea.id); previous = idea.id;
  }
  assert.equal(seen.size, OVERVIEW_IDEAS.length);
  assert.equal(nextOverviewIdea(previous).id, nextOverviewIdea().id);
});

test('obsolete or unavailable saved ideas recover to a usable note', () => {
  for (const id of [undefined, null, '', 'removed-note', {}, 12]) {
    const idea = nextOverviewIdea(id);
    assert.ok(OVERVIEW_IDEAS.includes(idea));
    assert.ok(idea.title && idea.detail && idea.category && idea.action);
  }
});

test('every note links to an existing studio destination and is labelled as evergreen guidance', () => {
  const destinations = new Set(['/admin/calendar', '/admin/crm', '/admin/data', '/admin/studio-projects', '/admin/quotations', '/admin/post-production', '/admin/crew', '/admin/settings?section=workspace']);
  assert.equal(new Set(OVERVIEW_IDEAS.map(idea => idea.id)).size, OVERVIEW_IDEAS.length);
  for (const idea of OVERVIEW_IDEAS) {
    assert.ok(destinations.has(idea.to));
    assert.ok(!/news|breaking|today only/i.test(idea.category));
  }
});
