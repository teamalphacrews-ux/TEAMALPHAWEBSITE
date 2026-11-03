import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('lazy document styles cannot blank an unrelated workspace printout', async () => {
  for (const file of ['workspace.css', 'pages/invoiceWorkspace.css']) {
    const css = await readFile(new URL('../src/admin/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /(?:^|[{}])\s*body\s*(?:>\s*)?\*\s*\{[^}]*visibility\s*:\s*hidden/, file + ' must scope print isolation to its document');
  }
});
