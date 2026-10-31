import test from 'node:test';
import assert from 'node:assert/strict';
import { installStudioBrowserTheme } from '../src/utils/studioBrowserTheme.js';

function fakeDocument() {
  const attr = new Map(), css = new Map(), metaAttr = new Map([['content','#F6F3ED']]);
  const meta = { getAttribute: key => metaAttr.get(key) ?? null, setAttribute: (key,value) => metaAttr.set(key,value), removeAttribute: key => metaAttr.delete(key) };
  return { querySelector: () => meta, documentElement: { style: { colorScheme: '', getPropertyValue: key => css.get(key) || '', setProperty: (key,value) => css.set(key,value), removeProperty: key => css.delete(key) }, setAttribute:(key,value)=>attr.set(key,value), removeAttribute:key=>attr.delete(key) }, meta, attr };
}
test('browser chrome tracks dark and light workspace themes and restores the public color', () => {
  const doc = fakeDocument();
  const restoreDark = installStudioBrowserTheme(doc, 'dark');
  assert.equal(doc.meta.getAttribute('content'), '#131416');
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(doc.attr.get('data-studio-browser-theme'), 'dark');
  restoreDark();
  assert.equal(doc.meta.getAttribute('content'), '#F6F3ED');
  assert.equal(doc.attr.has('data-studio-browser-theme'), false);
  const restoreLight = installStudioBrowserTheme(doc, 'light');
  assert.equal(doc.meta.getAttribute('content'), '#f2f3f0');
  restoreLight();
  assert.equal(doc.documentElement.style.getPropertyValue('--studio-browser-canvas'), '');
});
