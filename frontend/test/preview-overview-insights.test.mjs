import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildPreviewOverviewInsights } from '../src/utils/previewOverviewInsights.js';
const require = createRequire(import.meta.url);
const { overviewInsightWindow, groupOverviewRecords, buildOverviewInsights } = require('../../backend/utils/studioOverviewInsights.js');

function backend({ leads, tasks, events, now, timezone }) {
  const window = overviewInsightWindow(now, timezone), throughNow = new Date(new Date(now).getTime() + 1);
  const statuses = [...new Set(leads.map(lead => lead.status))];
  return buildOverviewInsights({
    leadCounts: statuses.map(status => ({ _id: status, count: leads.filter(lead => lead.status === status).length })),
    pendingTaskCount: tasks.filter(task => task.status === 'pending').length,
    completedTaskCount: tasks.filter(task => task.status === 'completed').length,
    leadActivity: groupOverviewRecords(leads, 'createdAt', window, false, throughNow),
    eventActivity: groupOverviewRecords(events, 'start', window),
    taskActivity: groupOverviewRecords(tasks, 'createdAt', window, false, throughNow),
    taskDueActivity: groupOverviewRecords(tasks, 'dueDate', window, true),
  }, new Date(now), timezone);
}

test('preview summaries match server counts across India midnight and DST', () => {
  for (const timezone of ['Asia/Kolkata', 'America/New_York', 'Asia/Kathmandu']) {
    for (const now of ['2026-10-27T01:00:00Z', '2026-03-09T01:00:00Z']) {
      const day = 86400000, instant = Date.parse(now);
      const at = offset => new Date(instant + offset * day).toISOString();
      const input = { now, timezone,
        leads: [{ status: 'New', createdAt: at(-2) }, { status: 'Converted', createdAt: at(-8) }, { status: 'New', createdAt: at(2) }, { status: 'New' }],
        tasks: [{ status: 'completed', dueDate: at(-1), createdAt: at(-3) }, { status: 'pending', dueDate: null, createdAt: at(-7) }, { status: 'pending', dueDate: 'invalid' }],
        events: [{ start: at(-3) }, { start: at(0) }, { start: at(8) }, {}],
      };
      assert.deepEqual(buildPreviewOverviewInsights(input), backend(input));
    }
  }
});

test('missing source lists are unavailable while complete empty lists are truthful zeroes', () => {
  assert.equal(buildPreviewOverviewInsights(), null);
  assert.equal(buildPreviewOverviewInsights({ leads: [], tasks: [] }), null);
  assert.equal(buildPreviewOverviewInsights({ leads: [], tasks: [], events: [], now: 'invalid' }), null);
  const input = { leads: [], tasks: [], events: [], now: '2026-10-27T01:00:00Z', timezone: 'Asia/Kolkata' };
  assert.deepEqual(buildPreviewOverviewInsights(input), backend(input));
  assert.equal(buildPreviewOverviewInsights(input).enquiries.changePercent, null);
});
