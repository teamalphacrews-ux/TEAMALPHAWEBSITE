import test from 'node:test';
import assert from 'node:assert/strict';
import { installStudioBrowserTheme } from '../src/utils/studioBrowserTheme.js';

function fakeDocument() {
  const attr = new Map(), css = new Map(), metaAttr = new Map([['content','#F6F3ED']]);
  const meta = { getAttribute: key => metaAttr.get(key) ?? null, setAttribute: (key,value) => metaAttr.set(key,value), removeAttribute: key => metaAttr.delete(key) };
  const viewportAttr = new Map([['content','width=device-width, initial-scale=1.0']]);
  const viewport = { getAttribute: key => viewportAttr.get(key), setAttribute: (key,value) => viewportAttr.set(key,value) };
  return { querySelector: selector => selector.includes('viewport') ? viewport : meta, documentElement: { style: { colorScheme: '', getPropertyValue: key => css.get(key) || '', setProperty: (key,value) => css.set(key,value), removeProperty: key => css.delete(key) }, setAttribute:(key,value)=>attr.set(key,value), removeAttribute:key=>attr.delete(key) }, meta, attr };
}
test('browser chrome tracks dark and light workspace themes and restores the public color', () => {
  const doc = fakeDocument();
  const restoreDark = installStudioBrowserTheme(doc, 'dark');
  assert.equal(doc.meta.getAttribute('content'), '#131416');
  assert.equal(doc.querySelector('meta[name="viewport"]').getAttribute('content'), 'width=device-width, initial-scale=1.0');
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(doc.attr.get('data-studio-browser-theme'), 'dark');
  restoreDark();
  assert.equal(doc.meta.getAttribute('content'), '#F6F3ED');
  assert.equal(doc.attr.has('data-studio-browser-theme'), false);
  const restoreLight = installStudioBrowserTheme(doc, 'light');
  assert.equal(doc.meta.getAttribute('content'), '#ffffff');
  restoreLight();
  assert.equal(doc.documentElement.style.getPropertyValue('--studio-browser-canvas'), '');
});
test('sign-in uses a white safe-area canvas rather than the public ivory theme, then restores it', () => {
  const doc = fakeDocument();
  const restore = installStudioBrowserTheme(doc, 'auth');
  assert.equal(doc.meta.getAttribute('content'), '#ffffff');
  assert.equal(doc.documentElement.style.getPropertyValue('--studio-browser-canvas'), '#ffffff');
  assert.equal(doc.documentElement.style.colorScheme, 'light');
  assert.equal(doc.attr.get('data-studio-browser-theme'), 'auth');
  restore();
  assert.equal(doc.meta.getAttribute('content'), '#F6F3ED');
  assert.equal(doc.attr.has('data-studio-browser-theme'), false);
});


test('commercial account routes use a dark edge-to-edge canvas and restore the previous viewport', () => {
  const doc = fakeDocument();
  const viewport = doc.querySelector('meta[name="viewport"]');
  const previous = 'width=device-width, initial-scale=1.0, viewport-fit=contain';
  viewport.setAttribute('content', previous);
  const restore = installStudioBrowserTheme(doc, 'product-auth');
  assert.equal(doc.meta.getAttribute('content'), '#000000');
  assert.equal(doc.documentElement.style.colorScheme, 'dark');
  assert.equal(doc.documentElement.style.getPropertyValue('--studio-browser-canvas'), '#000000');
  assert.equal(viewport.getAttribute('content'), 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  restore();
  assert.equal(viewport.getAttribute('content'), previous);
  assert.equal(doc.meta.getAttribute('content'), '#F6F3ED');
  assert.equal(doc.attr.has('data-studio-browser-theme'), false);
});
