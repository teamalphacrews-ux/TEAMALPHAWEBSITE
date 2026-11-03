import test from 'node:test';
import assert from 'node:assert/strict';
import { canCollapseLeadDraft, leadDraftSummary } from '../src/admin/components/studio/leadDraftPresentation.js';

const normal = { enabled: true, ready: true, online: true, candidate: null, error: '', status: 'idle' };

test('only routine ready online draft states may be collapsed', () => {
  for (const status of ['idle', 'saving', 'local', 'synced']) assert.equal(canCollapseLeadDraft({ ...normal, status }), true);
  for (const status of ['loading', 'recoverable', 'uncertain', 'unavailable', 'unknown']) assert.equal(canCollapseLeadDraft({ ...normal, status }), false);
});

test('candidate recovery, offline work, errors and unchecked storage remain visible', () => {
  for (const changes of [
    { candidate: { updatedAt: 1, uncertain: false } },
    { candidate: { updatedAt: 1, uncertain: true } },
    { online: false }, { error: 'Storage is full' }, { ready: false }, { enabled: false },
  ]) assert.equal(canCollapseLeadDraft({ ...normal, ...changes }), false);
});

test('summary labels distinguish a local save from a studio submission', () => {
  assert.equal(leadDraftSummary({ status: 'local' }), 'Draft saved on this device');
  assert.equal(leadDraftSummary({ status: 'saving' }), 'Saving local draft…');
  assert.equal(leadDraftSummary(normal), 'Local draft options');
});
