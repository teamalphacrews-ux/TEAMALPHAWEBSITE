import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STUDIO_APP_MODULES, STUDIO_APP_SETTINGS, appPreviewDestination } from './studioAppRoutes.js';
import { captureWorkspaceContext, nativeWorkspaceAvailable, saveNativeWorkspaceFile, notifyNativeWorkspaceChanged } from './nativeCapabilities.js';

test('the app catalog covers every current sidebar route', async () => {
  const source = (await Promise.all(['../admin/components/common/Sidebar.jsx', '../admin/components/common/workspaceNavigation.js'].map(path => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');
  const routes = [...source.matchAll(/path:\s*["'](\/admin[^"']*)["']/g)].map(match => match[1]);
  const catalog = new Set(STUDIO_APP_MODULES.map(item => item.path));
  for (const path of routes) assert.ok(catalog.has(path), 'Missing app module: ' + path);
  assert.equal(new Set(STUDIO_APP_MODULES.map(item => item.path)).size, STUDIO_APP_MODULES.length);
});

test('all actual settings sections are reachable in the app preview', async () => {
  const source = await readFile(new URL('../admin/pages/Settings.jsx', import.meta.url), 'utf8');
  const ids = [...source.matchAll(/^\s*\['([a-z]+)', '[^']+', '/gm)].map(match => match[1]);
  assert.equal(ids.length, 14);
  for (const id of ids) assert.ok(STUDIO_APP_SETTINGS.some(item => item.id === id), 'Missing setting: ' + id);
});

test('preview navigation supports real editors and rejects origin escapes', () => {
  for (const path of ['/admin', '/admin/quotations', '/admin/invoices/new', '/admin/contacts/abc', '/admin/settings?section=profile', '/admin/workspace?preview=saas']) assert.equal(appPreviewDestination(path), path);
  for (const path of ['https://attacker.example/admin', '//attacker.example/admin', '/admin/../../auth', '/admin\\evil', '/admin/settings/%2f..', '/admin/unknown', '/administrator', '/admin\n']) assert.equal(appPreviewDestination(path), null, path);
});

test('ordinary browser and server contexts keep their existing file behavior', async () => {
  assert.equal(nativeWorkspaceAvailable(), false);
  assert.equal(await saveNativeWorkspaceFile(new Blob(['test']), 'test.txt'), false);
  assert.doesNotThrow(notifyNativeWorkspaceChanged);
});

test('native saves pass the actual file and await platform confirmation', async () => {
  const blob = new Blob(['private test fixture']);
  let received;
  globalThis.window = { StudioOSNative: { available: true, saveFile: async (...args) => { received = args; } } };
  try {
    assert.equal(await saveNativeWorkspaceFile(blob, 'invoice.pdf'), true);
    assert.deepEqual(received, [blob, 'invoice.pdf']);
  } finally { delete globalThis.window; }
});

test('file failures remain visible instead of claiming a download succeeded', async () => {
  globalThis.window = { StudioOSNative: { available: true, saveFile: async () => { throw new Error('Device storage unavailable'); } } };
  try { await assert.rejects(saveNativeWorkspaceFile(new Blob(['test']), 'backup.json'), /Device storage unavailable/); }
  finally { delete globalThis.window; }
});

test('a missing or failing native context hook cannot prevent sign-out', () => {
  globalThis.window = { StudioOSNative: { contextChanged: () => { throw new Error('Bridge closed'); } } };
  try { assert.doesNotThrow(notifyNativeWorkspaceChanged); }
  finally { delete globalThis.window; }
});

test('a file prepared before logout or workspace switching cannot start a new transfer', async () => {
  const context = captureWorkspaceContext();
  let called = false;
  globalThis.window = { StudioOSNative: { available: true, saveFile: async () => { called = true; } } };
  try {
    notifyNativeWorkspaceChanged();
    await assert.rejects(saveNativeWorkspaceFile(new Blob(['old workspace']), 'private.pdf', context), /session changed/);
    assert.equal(called, false);
  } finally { delete globalThis.window; }
  await assert.rejects(saveNativeWorkspaceFile(new Blob(['old workspace']), 'private.pdf', context), /session changed/);
});
