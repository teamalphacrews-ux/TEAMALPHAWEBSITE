import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transformSync} from 'esbuild';
import * as jsxRuntime from 'react/jsx-runtime';
import {newRecordCreationKey} from '../src/utils/recordCreationKey.js';

const source = readFileSync(new URL('../src/admin/components/contacts/ContactWorkflowUI.jsx', import.meta.url), 'utf8');
const code = transformSync(source, {loader:'jsx', jsx:'automatic', format:'cjs'}).code;

for (const component of ['ContactForm', 'ProjectForm']) {
  test(component + ' reuses the original key for a retry and gives another form its own key', async () => {
    const calls = [], saved = [];
    const props = {onSaved: row => saved.push(row)};
    let slots = [], cursor = 0, finishAttempt;
    const hooks = {
      useState(initial) {
        const slot = cursor++;
        if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
        return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }];
      },
      useRef(initial) {
        const slot = cursor++;
        return slots[slot] ||= {current:initial};
      },
    };
    const transport = async (method, path, payload) => {
      calls.push({method, path, payload});
      if (calls.length === 1) await new Promise((_, reject) => { finishAttempt = () => reject(new Error('Synthetic timeout')); });
      return {_id:String(calls.length)};
    };
    const modules = {
      react:hooks, 'react/jsx-runtime':jsxRuntime,
      'react-hot-toast':{success:()=>{}},
      '../../../utils/recordCreationKey.js':{newRecordCreationKey},
      '../operations/workspaceData':{workspaceRequest:transport, recordError:e=>e.message},
    };
    const module = {exports:{}};
    runInNewContext(code, {module, require:name=>modules[name] || {}});
    const form = () => {
      cursor = 0;
      const tree = module.exports[component](props);
      return component === 'ContactForm' ? tree.props.children : tree;
    };
    const event = {preventDefault:()=>{}};
    const submit = form().props.onSubmit;
    const first = submit(event);
    await submit(event);
    assert.equal(calls.length, 1);
    finishAttempt();
    await first;
    assert.equal(saved.length, 0);
    await form().props.onSubmit(event);
    assert.equal(saved.length, 1);
    assert.match(calls[0].payload.creationKey, /^[a-f0-9]{32}$/);
    assert.equal(calls[1].payload.creationKey, calls[0].payload.creationKey);
    slots = [];
    await form().props.onSubmit(event);
    assert.equal(saved.length, 2);
    assert.notEqual(calls[2].payload.creationKey, calls[0].payload.creationKey);
    // Existing records go through the edit endpoint and never get a creation key.
    props[component === 'ContactForm' ? 'record' : 'project'] = {_id:'existing'};
    slots = [];
    await form().props.onSubmit(event);
    assert.equal(calls[3].method, 'patch');
    assert.equal(calls[3].payload.creationKey, undefined);
  });
}
