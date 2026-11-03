import test from 'node:test';
import assert from 'node:assert/strict';
import { removeQuoteItem, restoreQuoteItem } from '../src/admin/utils/quoteItemUndo.js';
const item = title => ({ title, description: `${title} coverage`, quantity: 2, unitPricePaise: 125050 });

test('Undo restores complete metadata and original order at every position', () => {
  const items = [item('Wedding'), { ...item('Reception'), _id: 'row-2', metadata: { crew: ['A'], weeks: 6 } }, item('Portraits')];
  for (const index of [0, 1, 2]) {
    const removed = removeQuoteItem(items, index, 7);
    assert.deepEqual(restoreQuoteItem(removed.items, removed.undo, 7), items);
  }
});
test('Undo keeps intervening edits to surviving rows', () => {
  const removed = removeQuoteItem([item('Wedding'), item('Reception'), item('Portraits')], 1, 3);
  const edited = removed.items.map((row, index) => index === 0 ? { ...row, quantity: 5, description: 'Extended' } : row);
  const restored = restoreQuoteItem(edited, removed.undo, 3);
  assert.equal(restored[0], edited[0]);
  assert.equal(restored[0].quantity, 5);
  assert.equal(restored[1].title, 'Reception');
  assert.equal(restored[2], edited[1]);
});
test('snapshot and restoration do not mutate nested metadata or inputs', () => {
  const row = { ...item('Wedding'), metadata: { crew: ['A'] } };
  const items = Object.freeze([row, Object.freeze(item('Reception'))]);
  const removed = removeQuoteItem(items, 0, 1);
  row.metadata.crew.push('B');
  assert.deepEqual(removed.undo.item.metadata.crew, ['A']);
  const restored = restoreQuoteItem(Object.freeze(removed.items), removed.undo, 1);
  restored[0].metadata.crew.push('C');
  assert.deepEqual(removed.undo.item.metadata.crew, ['A']);
  assert.equal(items.length, 2);
});
test('last row and invalid selections cannot be deleted', () => {
  const items = [item('A'), item('B')];
  assert.equal(removeQuoteItem([items[0]], 0, 2), null);
  for (const index of [-1, 2, 0.5, undefined]) assert.equal(removeQuoteItem(items, index, 2), null);
  assert.equal(removeQuoteItem(items, 0, undefined), null);
});
test('Undo cannot cross document sessions', () => {
  const removed = removeQuoteItem([item('A'), item('B')], 0, 8);
  assert.equal(restoreQuoteItem([item('Current quote')], removed.undo, 9), null);
  assert.equal(restoreQuoteItem([item('Current quote')], null, 8), null);
});
test('Undo respects maximum rows and bounds the original position', () => {
  const removed = removeQuoteItem([item('A'), item('B'), item('C')], 2, 4);
  const items = Array.from({ length: 40 }, (_, i) => item(String(i)));
  assert.equal(restoreQuoteItem(items, removed.undo, 4), null);
  assert.equal(restoreQuoteItem(items.slice(0, 39), removed.undo, 4).length, 40);
  assert.deepEqual(restoreQuoteItem([item('A')], removed.undo, 4), [item('A'), item('C')]);
});
