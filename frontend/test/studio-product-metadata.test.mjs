import test from 'node:test';
import assert from 'node:assert/strict';
import { installStudioProductIcons } from '../src/utils/studioProductMetadata.js';
import { STUDIO_X_FAVICON, STUDIO_X_TOUCH_ICON } from '../src/utils/branding.js';

function fakeDocument(withExisting = true) {
  const nodes = [];
  const createNode = (values = {}) => {
    const attrs = new Map(Object.entries(values));
    const node = {
      getAttribute: name => attrs.get(name) ?? null,
      setAttribute: (name, value) => attrs.set(name, value),
      removeAttribute: name => attrs.delete(name),
      remove: () => nodes.splice(nodes.indexOf(node), 1),
    };
    return node;
  };
  if (withExisting) nodes.push(createNode({ rel: 'icon', href: '/team-alpha.svg', type: 'image/svg+xml' }));
  return {
    nodes,
    querySelector: selector => nodes.find(node => selector === `link[rel="${node.getAttribute('rel')}"]`) || null,
    createElement: () => createNode(),
    head: { appendChild: node => nodes.push(node) },
  };
}

test('product icons restore the existing photography identity when leaving the workspace', () => {
  const doc = fakeDocument();
  const cleanup = installStudioProductIcons(doc);
  assert.equal(doc.querySelector('link[rel="icon"]').getAttribute('href'), STUDIO_X_FAVICON);
  assert.equal(doc.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'), STUDIO_X_TOUCH_ICON);
  cleanup();
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].getAttribute('href'), '/team-alpha.svg');
  assert.equal(doc.nodes[0].getAttribute('type'), 'image/svg+xml');
  assert.equal(doc.nodes[0].getAttribute('sizes'), null);
});

test('product icon setup leaves no extra links after cleanup on a page without icons', () => {
  const doc = fakeDocument(false);
  const cleanup = installStudioProductIcons(doc);
  assert.equal(doc.nodes.length, 2);
  cleanup();
  assert.equal(doc.nodes.length, 0);
});
