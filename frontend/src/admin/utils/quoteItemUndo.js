const validGeneration = value => Number.isInteger(value) && value >= 0;
const validItem = item => item && typeof item === 'object' && !Array.isArray(item);

// Snapshot only the deleted row, so Undo preserves edits to surviving items.
export function removeQuoteItem(items, index, generation) {
  if (!Array.isArray(items) || items.length <= 1 || !Number.isInteger(index) ||
      index < 0 || index >= items.length || !validGeneration(generation) || !validItem(items[index])) return null;
  return {
    items: items.filter((_, position) => position !== index),
    undo: { item: structuredClone(items[index]), index, generation },
  };
}

// The editor consumes Undo once and clears it on other structural changes.
export function restoreQuoteItem(items, undo, generation) {
  if (!Array.isArray(items) || items.length >= 40 || !undo || !validGeneration(generation) ||
      undo.generation !== generation || !Number.isInteger(undo.index) || undo.index < 0 || !validItem(undo.item)) return null;
  const index = Math.min(undo.index, items.length);
  return [...items.slice(0, index), structuredClone(undo.item), ...items.slice(index)];
}
