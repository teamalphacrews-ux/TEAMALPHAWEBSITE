import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as react from 'react';
const { createElement } = react;
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import * as studioTime from '../src/utils/studioTime.js';
import * as workspaceLocale from '../src/utils/workspaceLocale.js';

const source = readFileSync(new URL('../src/admin/pages/ProjectSlate.jsx', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' });
const projects = [
  { _id: 'nov', name: 'November shoot', startDate: '2026-11-30' },
  { _id: 'dec', name: 'December shoot', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-02' },
];
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-12-01T02:30:00Z'])); }
}

function render(view, browserZone, studioZone) {
  const savedZone = process.env.TZ;
  try {
    process.env.TZ = browserZone;
    const module = { exports: {} };
    const mocks = {
      react, 'react/jsx-runtime': jsxRuntime, './recordTransitions': {},
      'lucide-react': { ArrowUpRight: 'svg', CalendarDays: 'svg', MapPin: 'svg', Pin: 'svg' },
      'react-router-dom': { Link: ({ to, ...props }) => createElement('a', { ...props, href: to }) },
      '../components/common/StudioPreferences': { useStudioPreferences: () => ({ preferences: { timezone: 'studio' } }) },
      '../../utils/studioIdentity': { useStudioIdentity: () => ({ identity: { timezone: studioZone } }) },
      '../../utils/studioTime': studioTime,
      '../../utils/workspaceLocale': workspaceLocale,
    };
    runInNewContext(code, { module, Date: FixedDate, require: name => mocks[name] });
    return renderToStaticMarkup(createElement(module.exports[view], { projects, progress: new Map(), pinned: [], togglePin: () => {} }));
  } finally {
    if (savedZone === undefined) delete process.env.TZ;
    else process.env.TZ = savedZone;
  }
}

test('project dates stay on their saved day across browser timezones and the Today marker follows the studio', () => {
  for (const [browserZone, studioZone, todayOffset] of [
    ['America/Los_Angeles', 'Asia/Kolkata', 100 / 14],
    ['Asia/Kolkata', 'America/Los_Angeles', 0],
  ]) {
    const slate = render('ProjectSlate', browserZone, studioZone);
    assert.match(slate, /<strong>1<\/strong><small>Dec<\/small>/);
    assert.match(slate, /1 Dec 2026/);
    const timeline = render('ProjectTimeline', browserZone, studioZone);
    assert.match(timeline, /<h2>November 2026<\/h2>/);
    assert.match(timeline, /<h2>December 2026<\/h2>/);
    assert.match(timeline, /1 Dec 2026 – 2 Dec 2026/);
    assert.match(timeline, /class="record-gantt-bar" style="left:7\.142857142857143%;width:14\.285714285714286%/);
    const today = timeline.match(/class="record-gantt-today" style="left:([\d.]+)%/);
    assert.equal(Number(today?.[1]), todayOffset);
  }
});
