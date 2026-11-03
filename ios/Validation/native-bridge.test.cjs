const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(new URL('../StudioOS/Resources/StudioNativeBridge.js', 'file://' + __filename), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function boot({ framed = false, holdReads = false, fetcher, nativePostMessage } = {}) {
  const messages = [], readers = [], listeners = {};
  class Reader {
    readAsDataURL(blob) { this.blob = blob; readers.push(this); if (!holdReads) void this.finish(); }
    async finish() { this.result = 'data:application/octet-stream;base64,' + Buffer.from(await this.blob.arrayBuffer()).toString('base64'); this.onload(); }
  }
  const window = { webkit: { messageHandlers: { studioOS: { postMessage: value => { messages.push(value); return nativePostMessage ? nativePostMessage(value) : Promise.resolve(); } } } }, alert() {} };
  window.top = framed ? {} : window;
  const document = { documentElement: { setAttribute() {} }, querySelector: () => ({ content: 'width=device-width' }), addEventListener: (type, fn) => { listeners[type] = fn; } };
  vm.runInNewContext(source, { window, document, navigator: { userActivation: { isActive: true } }, Blob, FileReader: Reader, crypto: { randomUUID }, DOMException, URL, location: { origin: 'https://studio.example' }, fetch: fetcher });
  return { api: window.StudioOSNative, messages, readers, listeners };
}
test('subframes receive no native capability', () => {
  const value = boot({ framed: true }); assert.equal(value.api, undefined); assert.equal(value.listeners.click, undefined);
});
test('chunks preserve all bytes and ordering', async () => {
  const value = boot(); const input = Buffer.alloc(192 * 1024 + 1, 73);
  await value.api.saveFile(new Blob([input]), 'fixture.pdf');
  assert.deepEqual(value.messages.map(x => x.type), ['documentStart', 'documentChunk', 'documentChunk', 'documentEnd']);
  const chunks = value.messages.filter(x => x.type === 'documentChunk');
  assert.deepEqual(chunks.map(x => x.index), [0, 1]);
  assert.deepEqual(Buffer.concat(chunks.map(x => Buffer.from(x.data, 'base64'))), input);
});
test('workspace change during encoding sends no stale chunk', async () => {
  const value = boot({ holdReads: true }); const pending = value.api.saveFile(new Blob(['private']), 'private.json');
  const rejected = assert.rejects(pending, error => error.name === 'AbortError');
  await tick(); assert.equal(value.readers.length, 1);
  value.api.contextChanged(); await value.readers[0].finish(); await rejected;
  assert.ok(value.messages.some(x => x.type === 'documentAbort'));
  assert.ok(!value.messages.some(x => ['documentChunk', 'documentEnd'].includes(x.type)));
});
test('workspace change during blob fetch never starts native transfer', async () => {
  let release; const value = boot({ fetcher: () => new Promise(resolve => { release = resolve; }) });
  let prevented = false;
  value.listeners.click({ target: { closest: () => ({ href: 'blob:https://studio.example/fixture', download: 'private.json' }) }, preventDefault() { prevented = true; } });
  value.api.contextChanged(); release({ ok: true, blob: async () => new Blob(['private']) }); await tick(); await tick();
  assert.ok(prevented); assert.ok(!value.messages.some(x => x.type === 'documentStart'));
});
test('device controls validate values and preserve explicit actions',async()=>{
 const value=boot();await value.api.deviceStatus();await value.api.setPrivacyLock(true);await value.api.requestNotifications();await value.api.setWorkspaceContext({userId:'507f1f77bcf86cd799439011',workspaceKey:'legacy'});
 assert.deepEqual(value.messages.map(m=>m.type),['deviceStatus','privacyLock','requestNotifications','workspaceContext']);
 await assert.rejects(value.api.setPrivacyLock('false'));await assert.rejects(value.api.setWorkspaceContext({userId:'not-an-account',workspaceKey:'legacy'}));assert.equal(value.messages.length,4);
 await value.api.disconnectNotifications();assert.equal(value.messages.at(-1).type,'disconnectNotifications');
});

test('synchronous native failures become rejected promises', async () => {
  const value = boot({ nativePostMessage() { throw new Error('bridge closed'); } });
  const result = value.api.deviceStatus(); await assert.rejects(result, /bridge closed/);
});
test('malformed blob links preserve click dispatch', () => {
  const value = boot(); let prevented = false;
  assert.doesNotThrow(() => value.listeners.click({ target: { closest: () => ({ href: 'blob:not a URL', download: 'fixture' }) }, preventDefault() { prevented = true; } }));
  assert.equal(prevented, false); assert.equal(value.messages.length, 0);
});
test('switching identity cancels an in-flight document', async () => {
  const value=boot({holdReads:true});
  await value.api.setWorkspaceContext({userId:'507f1f77bcf86cd799439011',workspaceKey:'legacy'});
  const pending=value.api.saveFile(new Blob(['private'])), rejected=assert.rejects(pending,e=>e.name==='AbortError');
  await tick();
  await value.api.setWorkspaceContext({userId:'507f1f77bcf86cd799439012',workspaceKey:'legacy'});
  await value.readers[0].finish();await rejected;
  assert.ok(value.messages.some(x=>x.type==='contextChanged'));
  assert.ok(!value.messages.some(x=>['documentChunk','documentEnd'].includes(x.type)));
});
test('same identity preserves an active document',async()=>{
  const value=boot({holdReads:true}),context={userId:'507f1f77bcf86cd799439011',workspaceKey:'legacy'};
  await value.api.setWorkspaceContext(context);
  const pending=value.api.saveFile(new Blob(['private']));
  await tick();await value.api.setWorkspaceContext(context);await value.readers[0].finish();await pending;
  assert.ok(value.messages.some(x=>x.type==='documentEnd'));assert.ok(!value.messages.some(x=>x.type==='contextChanged'));
});
test('initial handshake preserves pending native notification',async()=>{
  const value=boot();await value.api.setWorkspaceContext({userId:'507f1f77bcf86cd799439011',workspaceKey:'legacy'});
  assert.deepEqual(value.messages.map(x=>x.type),['workspaceContext']);
});
