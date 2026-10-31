import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isolateDialogBackground, lockDialogScroll } from '../src/admin/components/studio/studioDialogIsolation.js';

function fixture() {
  class Element {
    constructor(tagName = 'DIV') { this.tagName = tagName; this.children = []; this.parentElement = null; this.inert = false; this.attributes = new Map(); this.ownerDocument = document; this.style = { overflow: '' }; }
    append(node) { node.parentElement = this; this.children.push(node); return node; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
  }
  const document = { defaultView: { HTMLElement: Element } };
  document.body = new Element('BODY');
  const root = document.body.append(new Element());
  const drawer = root.append(new Element());
  const workspace = root.append(new Element());
  const navigation = root.append(new Element('NAV'));
  return { document, root, drawer, workspace, navigation, Element };
}

test('closing and reopening the phone drawer restores workspace and bottom navigation input', () => {
  const { drawer, workspace, navigation } = fixture();
  for (let cycle = 0; cycle < 20; cycle++) {
    drawer.inert = false;
    const close = isolateDialogBackground(drawer);
    assert.equal(workspace.inert, true);
    assert.equal(navigation.inert, true);
    // Closing the drawer keeps the hidden drawer inert, without another owner
    // writing the background properties before the dialog effect cleans up.
    drawer.inert = true;
    close();
    assert.equal(workspace.inert, false);
    assert.equal(navigation.inert, false);
    assert.equal(workspace.getAttribute('aria-hidden'), null);
    assert.equal(navigation.getAttribute('aria-hidden'), null);
    assert.equal(drawer.inert, true);
  }
});

test('nested dialogs keep the background blocked until the last owner closes', () => {
  const { document, root, Element } = fixture();
  const outerSheet = document.body.append(new Element());
  const outerClose = isolateDialogBackground(outerSheet);
  const sheet = document.body.append(new Element());
  const innerClose = isolateDialogBackground(sheet);
  outerClose();
  assert.equal(root.inert, true);
  outerClose(); // Repeated cleanup must not consume the nested owner's count.
  assert.equal(root.inert, true);
  innerClose();
  assert.equal(root.inert, false);
});

test('existing hidden/inert content stays protected after dialog cleanup', () => {
  const { drawer, navigation } = fixture();
  navigation.inert = true;
  navigation.setAttribute('aria-hidden', 'false');
  const close = isolateDialogBackground(drawer);
  close();
  assert.equal(navigation.inert, true);
  assert.equal(navigation.getAttribute('aria-hidden'), 'false');
});

test('React and the dialog hook never both own inert on the workspace or bottom bar', () => {
  const layout = readFileSync(new URL('../src/admin/components/common/Layout.jsx', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../src/admin/components/common/MobileNavigation.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout.match(/<div className="studio-workspace"[^>]*>/)?.[0] || '', /\binert=/);
  assert.doesNotMatch(navigation.match(/<nav[^>]*>/)?.[0] || '', /\binert=/);
  assert.match(layout, /id="studio-navigation-drawer"[^>]*inert=\{isDrawerLayout && !drawerOpen\}/);
});

test('closing a parent before its dropdown never leaves page scrolling locked', () => {
  const { document } = fixture();
  for (let cycle = 0; cycle < 20; cycle++) {
    const closeParent = lockDialogScroll(document);
    const closeDropdown = lockDialogScroll(document);
    closeParent();
    assert.equal(document.body.style.overflow, 'hidden');
    closeParent();
    closeDropdown();
    assert.equal(document.body.style.overflow, '');
  }
});

test('normal nested dismissal preserves the original page scroll policy', () => {
  const { document } = fixture();
  document.body.style.overflow = 'auto';
  const closeParent = lockDialogScroll(document);
  const closeDropdown = lockDialogScroll(document);
  closeDropdown();
  assert.equal(document.body.style.overflow, 'hidden');
  closeParent();
  assert.equal(document.body.style.overflow, 'auto');
});

test('the drawer backdrop remains tappable while page controls are isolated', () => {
  const { drawer, root, workspace, Element } = fixture();
  drawer.id = 'studio-navigation-drawer';
  const backdrop = root.append(new Element('BUTTON'));
  backdrop.setAttribute('data-studio-dismiss-for', drawer.id);
  const close = isolateDialogBackground(drawer);
  assert.equal(backdrop.inert, false);
  assert.equal(workspace.inert, true);
  close();
  assert.equal(workspace.inert, false);
});

test('Operations forms and shared dialogs use the same scroll-lock owner', () => {
  for (const path of ['../src/admin/components/operations/OperationsUI.jsx', '../src/admin/components/studio/useStudioDialog.js']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /const restoreScroll = lockDialogScroll\(document\)/);
    assert.match(source, /restoreScroll\(\)/);
    assert.doesNotMatch(source, /document.body.style.overflow\s*=/);
  }
});
