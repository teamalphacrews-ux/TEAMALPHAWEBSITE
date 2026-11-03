import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Follow the route's eager source graph: a closed disclosure must not pull charts
// into its initial graph, including indirectly through the ledger breakdown.
function eagerDependencies(entry, visited = new Set(), packages = new Set()) {
  if (visited.has(entry)) return { files: visited, packages };
  visited.add(entry);
  const source = readFileSync(entry, 'utf8');
  const imports = /\b(?:import\s+(?:[\w*{}\s,$]+\s+from\s+)?|export\s+(?:\*|{[^}]*})\s+from\s+)["']([^"']+)["']/g;
  for (const [, name] of source.matchAll(imports)) {
    if (!name.startsWith('.')) { packages.add(name); continue; }
    const base = path.resolve(path.dirname(entry), name);
    const file = [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`].find(candidate => existsSync(candidate) && /\.(?:js|jsx|mjs)$/.test(candidate));
    if (file) eagerDependencies(file, visited, packages);
  }
  return { files: visited, packages };
}

test('Finance keeps charts out of its eager graph while preserving the ledger breakdown', () => {
  const entry = fileURLToPath(new URL('../src/admin/pages/Finance.jsx', import.meta.url));
  const { files, packages } = eagerDependencies(entry);
  assert.equal(packages.has('recharts'), false);
  assert.ok([...files].some(file => file.endsWith('/finance/ExpenseBreakdown.jsx')));
  assert.ok([...files].some(file => file.endsWith('/finance/FinanceAnalysis.jsx')));
  assert.equal([...files].some(file => file.endsWith('/finance/FinanceInsights.jsx')), false);
});
