import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanDraft } from '../src/offline/draftVault.js';

const source = readFileSync(new URL('../src/offline/OfflineDrafts.jsx', import.meta.url), 'utf8');
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Exercise the production hook's asynchronous identity changes without a DOM dependency.
function hookRunner(vault) {
  const start = source.indexOf('export function useOfflineDraft(');
  const end = source.indexOf('export function OfflineDraftStatus', start);
  assert.ok(start >= 0 && end > start);
  const hookSource = source.slice(start, end).replace('export function', 'function');
  const slots = [];
  let cursor = 0, effects = [], needsRender = false, args, result;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    useContext: () => ({ scope: 'u:one', online: true }),
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useState(initial) {
      const index = cursor++;
      slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const previous = slots[index].value;
        const value = typeof next === 'function' ? next(previous) : next;
        if (!Object.is(previous, value)) { slots[index].value = value; needsRender = true; }
      }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !same(previous.deps, deps)) effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    },
  };
  const hook = new Function('hooks', 'deviceDrafts', 'cleanDraft', 'Context', 'navigator', 'changed',
    `const {useContext,useRef,useState,useCallback,useEffect}=hooks; ${hookSource} return useOfflineDraft;`,
  )(hooks, vault, cleanDraft, {}, { onLine: true }, () => {});
  function render(next = args) {
    args = next; cursor = 0; effects = []; needsRender = false; result = hook(args);
    for (const effect of effects) effect();
    return result;
  }
  async function settle() {
    for (let turn = 0; turn < 20; turn++) {
      await new Promise(resolve => setImmediate(resolve));
      if (!needsRender) return result;
      render();
    }
    throw new Error('Draft hook did not settle');
  }
  return { render, settle, get current() { return result; } };
}

test('stale new-draft cleanup preserves persisted recovery and writes', async () => {
  const persistedRead = deferred();
  const removed = [], saved = [];
  const runner = hookRunner({
    async read(_scope, _kind, id) { return id === 'new' ? null : persistedRead.promise; },
    async remove(...args) { removed.push(args); },
    async save(...args) { saved.push(args); return { updatedAt: 10 }; },
  });
  const value = { clientName: 'Client', email: 'client@example.test', items: [{ title: 'Wedding', quantity: 1, unitPricePaise: 10000 }] };
  runner.render({ kind: 'quotation', recordId: 'new', value, dirty: false });
  await runner.settle();
  assert.equal(runner.current.ready, true);
  const oldClear = runner.current.clear;
  runner.render({ kind: 'quotation', recordId: 'quote-1', value, dirty: false });
  await runner.settle();
  assert.equal(runner.current.ready, false);
  await oldClear();
  persistedRead.resolve(null);
  await runner.settle();
  assert.equal(runner.current.identity, 'u:one:quotation:quote-1');
  assert.equal(runner.current.ready, true);
  assert.equal(runner.current.status, 'idle');
  assert.deepEqual(removed, [['u:one', 'quotation', 'new']]);
  assert.equal(await runner.current.saveNow(), true);
  await runner.settle();
  assert.equal(saved[0][2], 'quote-1');
  assert.equal(runner.current.status, 'local');
  assert.equal(runner.current.isCurrent, true);
});
