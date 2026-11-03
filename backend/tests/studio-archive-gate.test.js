const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AsyncResource } = require('node:async_hooks');
const { createArchiveGate, EXCLUSIVE_LEASE_MS } = require('../services/studioArchiveGate');

function fixture({ paused = false, workspace = null } = {}) {
  let time = 1_000_000, sequence = 0, state;
  const timers = [], calls = [];
  const clone = value => value == null ? value : structuredClone(value);
  const matches = (filter, row) => {
    if (!row) return false;
    for (const [key, expected] of Object.entries(filter)) {
      if (key === '$or') { if (!expected.some(part => matches(part, row))) return false; continue; }
      if (key === 'readers') {
        if (!row.readers.some(reader => matches(expected.$elemMatch, reader))) return false;
        continue;
      }
      let actual;
      if (key === 'readers.id') { if (!row.readers.some(reader => reader.id === expected)) return false; continue; }
      if (key === 'readers.expiresAt') { if (!row.readers.some(reader => Number(reader.expiresAt) <= Number(expected.$lte))) return false; continue; }
      if (/^readers\.\d+$/.test(key)) actual = row.readers[Number(key.split('.')[1])];
      else actual = row[key];
      if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
        if ('$ne' in expected && actual === expected.$ne) return false;
        if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
        if ('$lte' in expected && !(actual != null && Number(actual) <= Number(expected.$lte))) return false;
        if ('$gt' in expected && !(actual != null && Number(actual) > Number(expected.$gt))) return false;
      } else if (expected === null) { if (actual != null) return false; }
      else if (actual !== expected) return false;
    }
    return true;
  };
  function apply(update, filter) {
    if (update.$push?.readers) state.readers.push(clone(update.$push.readers));
    if (update.$pull?.readers) state.readers = state.readers.filter(reader => !matches(update.$pull.readers, reader));
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key === 'readers.$.expiresAt') {
        const reader = state.readers.find(item => item.id === filter.readers.$elemMatch.id);
        reader.expiresAt = clone(value);
      } else state[key] = clone(value);
    }
    for (const key of Object.keys(update.$unset || {})) delete state[key];
    for (const [key, value] of Object.entries(update.$inc || {})) state[key] += value;
  }
  const q = work => ({ lean: async () => work(), session() { return this; } });
  const State = {
    findOneAndUpdate(filter, update, options = {}) {
      return q(() => {
        calls.push(['findOneAndUpdate', filter, update]);
        if (!state && options.upsert) state = { _id: 'legacy', ...clone(update.$setOnInsert), integrationsPaused: paused };
        if (!matches(filter, state)) return null;
        apply(update, filter); return clone(state);
      });
    },
    findById() { return q(() => clone(state)); },
    findOne(filter) { return q(() => matches(filter, state) ? clone(state) : null); },
    async updateOne(filter, update) {
      calls.push(['updateOne', filter, update]);
      if (!matches(filter, state)) return { matchedCount: 0, modifiedCount: 0 };
      apply(update, filter); return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  const gate = createArchiveGate({ State, now: () => time, randomId: () => 'lease-' + (++sequence),
    workspace: () => workspace, setTimer: callback => { timers.push(callback); return { unref() {} }; }, clearTimer() {} });
  return { gate, State, calls, timers, get state() { return state; }, advance(ms) { time += ms; } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('an active request blocks exclusive maintenance and releases cleanly', async () => {
  const f = fixture(), entered = deferred(), finish = deferred();
  const shared = f.gate.withShared(async () => { entered.resolve(); await finish.promise; });
  await entered.promise;
  assert.equal(f.state.readers.length, 1);
  await assert.rejects(f.gate.withExclusive(async () => assert.fail('exclusive must not run')), error => error.status === 409);
  finish.resolve(); await shared;
  assert.equal(f.state.readers.length, 0);
  await f.gate.withExclusive(async context => {
    assert.equal(context.mode, 'exclusive'); assert.ok(f.state.maintenanceToken);
    await f.gate.assertExclusive();
  });
  assert.equal(f.state.maintenanceToken, undefined);
});

test('nested fire-and-forget work retains its reader after the originating request ends', async () => {
  const f = fixture(), entered = deferred(), finish = deferred(); let background;
  await f.gate.withShared(() => {
    background = f.gate.withShared(async () => { entered.resolve(); await finish.promise; });
  });
  await entered.promise;
  assert.equal(f.state.readers.length, 1);
  await assert.rejects(f.gate.withExclusive(() => {}), error => error.status === 409);
  finish.resolve(); await background;
  assert.equal(f.state.readers.length, 0);
});

test('generation changes and expired reader leases fail closed before writes', async () => {
  const f = fixture();
  await f.gate.withShared(async () => {
    f.state.dataVersion++;
    await assert.rejects(f.gate.assertWrite({ modelName: 'Lead' }), error => error.code === 'WORKSPACE_GENERATION_CHANGED');
  });
  const expired = fixture();
  await expired.gate.withShared(async () => {
    expired.advance(60_001);
    await assert.rejects(expired.gate.assertWrite({ modelName: 'Invoice' }), error => error.status === 409);
  });
});

test('callbacks inherited from a completed request cannot write into the new generation', async () => {
  const f = fixture(); let callback, resource;
  await f.gate.withShared(() => {
    resource = new AsyncResource('old-studio-callback');
    callback = () => resource.runInAsyncScope(() => f.gate.assertWrite({ modelName: 'StudioConfig' }));
  });
  await f.gate.withExclusive(async () => { f.state.dataVersion++; });
  await assert.rejects(callback(), error => error.status === 409);
  resource.emitDestroy();
});

test('heartbeats retain active readers and invalidate the context on database failure', async () => {
  const f = fixture();
  await f.gate.withShared(async () => {
    f.advance(15_000); await f.timers[0]();
    assert.ok(Number(f.state.readers[0].expiresAt) > 1_060_000);
    const original = f.State.updateOne;
    f.State.updateOne = async () => { throw new Error('private database connection'); };
    await f.timers[0]();
    f.State.updateOne = original;
    await assert.rejects(f.gate.assertWrite({ modelName: 'Task' }), error => error.status === 409);
  });
});

test('a stale exclusive owner cannot clear a replacement lease or commit after expiry', async () => {
  const f = fixture();
  await f.gate.withExclusive(async () => {
    f.advance(EXCLUSIVE_LEASE_MS + 1);
    await assert.rejects(f.gate.assertExclusive(), error => error.status === 409);
    await assert.rejects(f.gate.assertWrite({ modelName: 'User' }), error => error.status === 409);
    f.state.maintenanceToken = 'replacement';
  });
  assert.equal(f.state.maintenanceToken, 'replacement');
});

test('tenant jobs bypass the personal gate and cannot acquire personal exclusive maintenance', async () => {
  const f = fixture({ workspace: { _id: 'a'.repeat(24) } });
  assert.equal(await f.gate.withShared(() => 'tenant'), 'tenant');
  await f.gate.assertWrite({ modelName: 'Invoice' });
  await assert.rejects(f.gate.withExclusive(() => {}), error => error.status === 403);
  assert.equal(f.calls.length, 0);
});

test('paused integrations skip provider workers without running their callbacks', async () => {
  const f = fixture({ paused: true }); let called = false;
  assert.deepEqual(await f.gate.withShared(() => { called = true; }, { integrations: true }), { skipped: true, paused: true });
  assert.equal(called, false); assert.equal(f.state.readers.length, 0);
  assert.equal(await f.gate.withShared(() => 'local archive'), 'local archive');
});

test('HTTP middleware releases a closed response but retains independent provider work', async () => {
  const f = fixture(), entered = deferred(), finish = deferred(), response = new EventEmitter();
  Object.assign(response, { headersSent: false, set() {}, status() { return this; }, json() { this.headersSent = true; this.emit('finish'); } });
  const req = { originalUrl: '/api/invoices/a/send' }; let background;
  f.gate.middleware()(req, response, () => {
    background = f.gate.withShared(async () => { entered.resolve(); await finish.promise; });
    response.emit('close');
  });
  await entered.promise;
  assert.equal(req.studioDataVersion, 0);
  await assert.rejects(f.gate.withExclusive(() => {}), error => error.status === 409);
  finish.resolve(); await background;
  assert.equal(f.state.readers.length, 0);
});

test('provider webhooks are paused while archive handlers gate themselves', async () => {
  const f = fixture({ paused: true }), done = deferred(), response = new EventEmitter();
  Object.assign(response, { headersSent: false, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; done.resolve(); } });
  f.gate.middleware()({ originalUrl: '/api/auth/google/webhook' }, response, () => assert.fail('paused webhook must not run'));
  await done.promise; assert.equal(response.statusCode, 503); assert.equal(response.body.code, 'WORKSPACE_INTEGRATIONS_PAUSED');
  let next = false;
  f.gate.middleware()({ originalUrl: '/api/studio/security/workspace-reset' }, {}, () => { next = true; });
  assert.equal(next, true);
});

test('the write plugin covers document, query, insertMany, bulkWrite and aggregate writes', async () => {
  const f = fixture(), hooks = [];
  const mongoose = { plugin(callback) { callback({ pre(...args) { hooks.push(['pre', ...args]); }, post(...args) { hooks.push(['post', ...args]); }, on(...args) { hooks.push(['event', ...args]); } }); } };
  f.gate.installWriteFence(mongoose); f.gate.installWriteFence(mongoose);
  assert.ok(hooks.some(hook => hook[0] === 'pre' && Array.isArray(hook[1]) && hook[1].includes('save')));
  assert.ok(hooks.some(hook => hook[0] === 'pre' && Array.isArray(hook[1]) && hook[1].includes('updateMany')));
  assert.ok(hooks.some(hook => hook[0] === 'pre' && Array.isArray(hook[1]) && hook[1].includes('insertMany') && hook[1].includes('bulkWrite')));
  assert.ok(hooks.some(hook => hook[0] === 'pre' && hook[1] === 'aggregate'));
  await assert.rejects(f.gate.assertWrite({ modelName: 'Lead' }), error => error.code === 'WORKSPACE_WRITE_UNFENCED');
  await f.gate.assertWrite({ modelName: 'StudioArchiveChunk' });
  await f.gate.assertWrite({ modelName: 'SaaSAccount' });
  await f.gate.withShared(() => f.gate.assertWrite({ modelName: 'Lead' }));
});

test('real Mongoose document and query middleware fence writes and release operation pins', async () => {
  const f = fixture(), mongoose = new (require('mongoose').Mongoose)();
  f.gate.installWriteFence(mongoose);
  const Model = mongoose.model('Lead', new mongoose.Schema({ name: { type: String, required: true } }));
  let writes = 0;
  Model.collection.updateOne = async () => { writes++; return { acknowledged: true, matchedCount: 1 }; };
  Model.collection.insertOne = async doc => { writes++; return { acknowledged: true, insertedId: doc._id }; };
  Model.collection.deleteOne = async () => { writes++; return { acknowledged: true, deletedCount: 1 }; };
  Model.collection.insertMany = async () => { writes++; return { acknowledged: true }; };
  Model.collection.bulkWrite = async () => { writes++; return { acknowledged: true }; };
  await assert.rejects(Model.updateOne({}, { $set: { name: 'unfenced' } }), error => error.code === 'WORKSPACE_WRITE_UNFENCED');
  await assert.rejects(new Model({ name: 'unfenced' }).save(), error => error.code === 'WORKSPACE_WRITE_UNFENCED');
  await assert.rejects(Model.insertMany([{ name: 'unfenced' }]), error => error.code === 'WORKSPACE_WRITE_UNFENCED');
  await assert.rejects(Model.bulkWrite([{ insertOne: { document: { name: 'unfenced' } } }]), error => error.code === 'WORKSPACE_WRITE_UNFENCED');
  assert.equal(writes, 0);
  await f.gate.withShared(async () => {
    await Model.updateOne({}, { $set: { name: 'safe' } });
    const doc = await new Model({ name: 'safe' }).save();
    await doc.deleteOne();
    await Model.insertMany([{ name: 'safe' }]);
    await Model.bulkWrite([{ insertOne: { document: { name: 'safe' } } }]);
  });
  assert.equal(writes, 5); assert.equal(f.state.readers.length, 0);
});

test('expired readers persistently block exclusive work until documented operator maintenance', async () => {
  const f = fixture(), entered = deferred(), finish = deferred();
  const old = f.gate.withShared(async () => { entered.resolve(); await finish.promise; });
  await entered.promise; f.advance(60_001);
  await assert.rejects(f.gate.withExclusive(() => assert.fail('must stay blocked')), error => error.code === 'WORKSPACE_UNCERTAIN_READERS');
  assert.equal(f.state.uncertainReaders, true);
  finish.resolve(); await old;
  assert.equal(await f.gate.withShared(() => 'normal work'), 'normal work');
  assert.equal((await f.gate.getState()).uncertainReaders, true);
  await assert.rejects(f.gate.withExclusive(() => {}), error => error.code === 'WORKSPACE_UNCERTAIN_READERS');
  // Simulates documented operator-only DB repair after every old process and
  // transaction has stopped. There is deliberately no HTTP auto-clear API.
  await f.State.updateOne({ _id: 'legacy' }, { $set: { uncertainReaders: false, readers: [] } });
  await f.gate.withExclusive(() => 'maintenance admitted');
});

test('concurrent bulk operations retain their own leases through reverse completion and errors', async () => {
  const f = fixture(), mongoose = new (require('mongoose').Mongoose)();
  f.gate.installWriteFence(mongoose);
  const Model = mongoose.model('BulkRecord', new mongoose.Schema({ name: { type: String, required: true } }));
  const enteredA = deferred(), enteredB = deferred(), finishA = deferred(), finishB = deferred();
  Model.collection.insertMany = async rows => {
    const name = rows[0].name;
    (name === 'A' ? enteredA : enteredB).resolve();
    await (name === 'A' ? finishA : finishB).promise;
    if (name === 'B') throw new Error('synthetic failed insertion');
    return { acknowledged: true };
  };
  let bulkA, bulkB;
  await f.gate.withShared(() => { bulkA = Model.insertMany([{ name: 'A' }]); });
  await enteredA.promise;
  await f.gate.withShared(() => { bulkB = Model.insertMany([{ name: 'B' }]); });
  const failureB = assert.rejects(bulkB, /synthetic failed insertion/);
  await enteredB.promise;
  assert.equal(f.state.readers.length, 2);
  finishB.resolve(); await failureB;
  assert.equal(f.state.readers.length, 1);
  await assert.rejects(f.gate.withExclusive(() => {}), error => error.status === 409);
  finishA.resolve(); await bulkA;
  assert.equal(f.state.readers.length, 0);
  await f.gate.withShared(async () => {
    await assert.rejects(Model.insertMany([{}]), /validation/i);
  });
  assert.equal(f.state.readers.length, 0);
});

test('paused incoming enquiry webhooks cannot recreate business records after reset',async()=>{
 const f=fixture({paused:true}),done=deferred(),response=new EventEmitter();let next=false;
 Object.assign(response,{headersSent:false,status(code){this.statusCode=code;return this;},json(body){this.body=body;done.resolve();}});
 f.gate.middleware()({originalUrl:'/API/WEBHOOKS/ENQUIRIES/?delivery=1'},response,()=>{next=true;});
 await done.promise;assert.equal(next,false);assert.equal(response.statusCode,503);assert.equal(response.body.code,'WORKSPACE_INTEGRATIONS_PAUSED');
});
test('SaaS control-plane paths bypass the personal maintenance state entirely',()=>{
 const f=fixture();
 for(const originalUrl of ['/api/saas/config','/API/SAAS/signup','/api/saas/billing/webhook?delivery=1','/api/saas']){
  let next=false;f.gate.middleware()({originalUrl},{},()=>{next=true;});assert.equal(next,true,originalUrl);
 }
 assert.equal(f.calls.length,0);
});
