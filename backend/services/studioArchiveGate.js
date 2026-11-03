const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { currentWorkspace } = require('../saas/tenantContext');

const READER_LEASE_MS = 60_000;
const HEARTBEAT_MS = 15_000;
const EXCLUSIVE_LEASE_MS = 10 * 60_000;
const MAX_READERS = 256;
const fail = (message, status = 409, code = 'WORKSPACE_BUSY') =>
  Object.assign(new Error(message), { status, code });
const unavailable = () => fail('Workspace safety checks are unavailable. Please try again.', 503, 'WORKSPACE_GATE_UNAVAILABLE');
const excluded = name => !name || /^SaaS/.test(name) ||
  ['StudioArchiveState', 'StudioArchive', 'StudioArchiveChunk', 'StudioPushDevice'].includes(name);
const installations = new WeakSet();

function createArchiveGate({
  State, now = Date.now, randomId = () => crypto.randomUUID(),
  workspace = currentWorkspace, setTimer = setInterval, clearTimer = clearInterval,
} = {}) {
  const storage = new AsyncLocalStorage();
  const pins = new WeakMap();
  const bulkModels = new WeakSet();
  const model = () => State || require('../models/StudioArchiveState');
  const stamp = () => new Date(now());
  const noMaintenance = at => ({ $or: [
    { maintenanceUntil: { $lte: at } },
    { maintenanceUntil: { $exists: false } },
    { maintenanceUntil: null },
  ] });
  const query = (value, session) => {
    if (session && typeof value.session === 'function') value = value.session(session);
    return typeof value.lean === 'function' ? value.lean() : value;
  };
  async function database(work) {
    try { return await work(); }
    catch (error) { if (error?.status) throw error; throw unavailable(); }
  }
  async function getState() {
    return database(async () => {
      let row;
      try {
        row = await query(model().findOneAndUpdate(
          { _id: 'legacy' },
          { $setOnInsert: { dataVersion: 0, integrationsPaused: false, uncertainReaders: false, readers: [] } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ));
      } catch (error) {
        if (error.code !== 11000) throw error;
        row = await query(model().findById('legacy'));
      }
      if (!row || !Number.isSafeInteger(row.dataVersion) || row.dataVersion < 0 ||
          !Array.isArray(row.readers)) throw unavailable();
      return row;
    });
  }
  async function prune() {
    await database(() => model().updateOne(
      { _id: 'legacy', 'readers.expiresAt': { $lte: stamp() } },
      { $set: { uncertainReaders: true }, $pull: { readers: { expiresAt: { $lte: stamp() } } } },
    ));
  }
  function retain(context) {
    if (!context || context.closed || context.invalid ||
        (context.mode === 'exclusive' && now() >= context.until)) {
      throw fail('Workspace data changed. Reload before trying again.', 409, 'WORKSPACE_GENERATION_CHANGED');
    }
    context.refs++;
  }
  async function release(context) {
    context.refs--;
    if (context.refs > 0 || context.closed) return;
    context.closed = true;
    if (context.timer) clearTimer(context.timer);
    // Token filters cannot release a replacement lease after a crash/expiry.
    try {
      if (context.mode === 'exclusive') await model().updateOne(
        { _id: 'legacy', maintenanceToken: context.id },
        { $unset: { maintenanceToken: 1, maintenanceUntil: 1 } },
      );
      else await model().updateOne(
        { _id: 'legacy', dataVersion: context.dataVersion, 'readers.id': context.id },
        { $pull: { readers: { id: context.id } } },
      );
    } catch { /* A failed cleanup expires safely; never undo a committed operation. */ }
  }
  async function assertCurrent(context, session) {
    if (context.closed || context.invalid) throw fail('Workspace data changed. Reload before trying again.', 409, 'WORKSPACE_GENERATION_CHANGED');
    const at = stamp();
    const result = await database(() => model().updateOne(
      { _id: 'legacy', dataVersion: context.dataVersion,
        ...noMaintenance(at),
        readers: { $elemMatch: { id: context.id, dataVersion: context.dataVersion, expiresAt: { $gt: at } } } },
      { $set: { 'readers.$.expiresAt': new Date(now() + READER_LEASE_MS) } },
      session ? { session } : undefined,
    ));
    if (context.closed || context.invalid || result.matchedCount !== 1) {
      context.invalid = true;
      throw fail('Workspace data changed. Reload before trying again.', 409, 'WORKSPACE_GENERATION_CHANGED');
    }
  }
  function heartbeat(context) {
    let busy = false;
    context.timer = setTimer(async () => {
      if (busy || context.closed || context.invalid) return;
      busy = true;
      try { await assertCurrent(context); } catch { context.invalid = true; }
      finally { busy = false; }
    }, HEARTBEAT_MS);
    context.timer?.unref?.();
  }
  async function acquireShared() {
    const state = await getState();
    await prune();
    const id = randomId(), at = stamp();
    const row = await database(() => query(model().findOneAndUpdate(
      { _id: 'legacy', dataVersion: state.dataVersion, ...noMaintenance(at),
        ['readers.' + (MAX_READERS - 1)]: { $exists: false } },
      { $push: { readers: { id, dataVersion: state.dataVersion, expiresAt: new Date(now() + READER_LEASE_MS) } } },
      { new: true },
    )));
    if (!row) throw fail('Workspace maintenance is in progress. Please try again shortly.');
    const context = { mode: 'shared', id, dataVersion: row.dataVersion,
      integrationsPaused: row.integrationsPaused === true, refs: 1, closed: false, invalid: false };
    heartbeat(context);
    return context;
  }
  async function withShared(work, { integrations = false, rejectPaused = false } = {}) {
    if (typeof work !== 'function') throw new TypeError('Workspace work must be a function.');
    if (workspace()) return work();
    const existing = storage.getStore();
    if (existing?.mode === 'exclusive') {
      if (integrations) {
        if (rejectPaused) throw fail('Studio integrations are paused during workspace maintenance.', 409, 'WORKSPACE_INTEGRATIONS_PAUSED');
        return { skipped: true, paused: true };
      }
      retain(existing); try { return await work(existing); } finally { await release(existing); }
    }
    if (existing) {
      // Retain synchronously: a fire-and-forget provider callback must keep its
      // reader alive even if the originating HTTP response finishes meanwhile.
      retain(existing);
      try {
        await assertCurrent(existing);
        if (integrations && existing.integrationsPaused) {
          if (rejectPaused) throw fail('Studio integrations are paused. The owner can resume them from recovery settings.', 409, 'WORKSPACE_INTEGRATIONS_PAUSED');
          return { skipped: true, paused: true };
        }
        return await work(existing);
      } finally { await release(existing); }
    }
    const context = await acquireShared();
    return storage.run(context, async () => {
      try {
        if (integrations && context.integrationsPaused) {
          if (rejectPaused) throw fail('Studio integrations are paused. The owner can resume them from recovery settings.', 409, 'WORKSPACE_INTEGRATIONS_PAUSED');
          return { skipped: true, paused: true };
        }
        return await work(context);
      } finally { await release(context); }
    });
  }
  async function withExclusive(work) {
    if (typeof work !== 'function') throw new TypeError('Workspace work must be a function.');
    if (workspace()) throw fail('Workspace archives are available for the personal installation only.', 403, 'WORKSPACE_SCOPE_UNSUPPORTED');
    const existing = storage.getStore();
    if (existing) {
      if (existing.mode !== 'exclusive') throw fail('Finish current studio work before starting maintenance.');
      retain(existing); try { return await work(existing); } finally { await release(existing); }
    }
    await getState(); await prune();
    const id = randomId(), at = stamp(), until = now() + EXCLUSIVE_LEASE_MS;
    const row = await database(() => query(model().findOneAndUpdate(
      { _id: 'legacy', ...noMaintenance(at), uncertainReaders: { $ne: true }, 'readers.0': { $exists: false } },
      { $set: { maintenanceToken: id, maintenanceUntil: new Date(until) } },
      { new: true },
    )));
    if (!row) {
      const state = await getState();
      if (state.uncertainReaders === true) throw fail(
        'A previous studio operation expired. An operator must stop all old backend processes and clear the safety block before maintenance.',
        409, 'WORKSPACE_UNCERTAIN_READERS',
      );
      throw fail('Studio work is still running. Wait for it to finish, then retry maintenance.');
    }
    const context = { mode: 'exclusive', id, token: id, until,
      dataVersion: row.dataVersion, refs: 1, closed: false, invalid: false };
    // A fixed bounded lease avoids heartbeat writes to the same State document
    // while the reset transaction updates dataVersion (which would conflict).
    return storage.run(context, async () => {
      try { return await work(context); } finally { await release(context); }
    });
  }
  async function assertExclusive(session) {
    const context = storage.getStore();
    if (!context || context.mode !== 'exclusive' || context.closed || context.invalid || now() >= context.until) {
      throw fail('The workspace maintenance lease has ended. Nothing was committed.');
    }
    const row = await database(() => query(model().findOne(
      { _id: 'legacy', maintenanceToken: context.id, maintenanceUntil: { $gt: stamp() } },
    ), session));
    if (!row) { context.invalid = true; throw fail('The workspace maintenance lease has ended. Nothing was committed.'); }
    return context;
  }
  function middleware() {
    return (req, res, next) => {
      if (workspace() || /^\/api\/saas(?:[/?]|$)/i.test(req.originalUrl || '') || /^\/api\/studio\/security\/workspace-[a-z-]+(?:[/?]|$)/.test(req.originalUrl || '')) return next();
      withShared(context => new Promise((resolve, reject) => {
        const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
        if (context.integrationsPaused &&
            ['/api/auth/google/webhook', '/api/integrations/whatsapp/webhook', '/api/webhooks/enquiries'].includes(path)) {
          res.status(503).json({ error: 'Studio integrations are paused. The owner can resume them from recovery settings.', code: 'WORKSPACE_INTEGRATIONS_PAUSED' });
          resolve(); return;
        }
        req.studioDataVersion = context.dataVersion;
        res.set?.('X-Studio-Data-Version', String(context.dataVersion));
        const done = () => { res.removeListener?.('finish', done); res.removeListener?.('close', done); resolve(); };
        res.once('finish', done); res.once('close', done);
        try { next(); } catch (error) { done(); reject(error); }
      })).catch(error => {
        if (!res.headersSent) res.status(error.status || 503).json({ error: error.message || 'Workspace checks are unavailable.', code: error.code || 'WORKSPACE_GATE_UNAVAILABLE' });
        else res.destroy?.();
      });
    };
  }
  const modelName = target => target?.modelName || target?.model?.modelName || target?.constructor?.modelName || target?._model?.modelName;
  const sessionFor = target => target?.getOptions?.().session || target?.$session?.();
  async function pinWrite(target) {
    if (workspace() || excluded(modelName(target))) return;
    const context = storage.getStore();
    if (!context) throw fail('This write has no active workspace safety lease.', 503, 'WORKSPACE_WRITE_UNFENCED');
    retain(context);
    try {
      if (context.mode !== 'exclusive') await assertCurrent(context, sessionFor(target));
      const stack = pins.get(target) || []; stack.push(context); pins.set(target, stack);
    } catch (error) { await release(context); throw error; }
  }
  async function unpinWrite(target) {
    const stack = pins.get(target); if (!stack?.length) return;
    const context = stack.pop(); if (!stack.length) pins.delete(target);
    await release(context);
  }
  async function assertWrite(target) {
    if (workspace() || excluded(modelName(target))) return;
    const context = storage.getStore();
    if (!context) throw fail('This write has no active workspace safety lease.', 503, 'WORKSPACE_WRITE_UNFENCED');
    retain(context);
    try { if (context.mode !== 'exclusive') await assertCurrent(context, sessionFor(target)); }
    finally { await release(context); }
  }
  function installWriteFence(mongoose) {
    if (installations.has(mongoose)) return;
    installations.add(mongoose);
    mongoose.plugin(schema => {
      const methods = ['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace'];
      schema.pre(methods, { query: true, document: false }, async function () { await pinWrite(this); });
      schema.post(methods, function (_result, next) { unpinWrite(this).then(() => next(), next); });
      schema.post(methods, function (error, _result, next) { unpinWrite(this).then(() => next(error), () => next(error)); });
      schema.pre(['save', 'deleteOne'], { document: true, query: false }, async function () { await pinWrite(this); });
      schema.post(['save', 'deleteOne'], { document: true, query: false }, function (_doc, next) { unpinWrite(this).then(() => next(), next); });
      schema.post(['save', 'deleteOne'], { document: true, query: false }, function (error, _doc, next) { unpinWrite(this).then(() => next(error), () => next(error)); });
      // Mongoose model middleware shares `this` across concurrent calls.
      // Wrap the actual returned promise instead of storing a model-wide pin:
      // validation errors, early bulk returns and reverse completion order all
      // retain their own reader until the complete operation settles.
      schema.on('init', Model => {
        if (bulkModels.has(Model)) return;
        bulkModels.add(Model);
        for (const method of ['insertMany', 'bulkWrite']) {
          const original = Model[method];
          Model[method] = async function (...args) {
            if (workspace() || excluded(this.modelName)) return original.apply(this, args);
            if (!storage.getStore()) throw fail('This write has no active workspace safety lease.', 503, 'WORKSPACE_WRITE_UNFENCED');
            return withShared(() => original.apply(this, args));
          };
        }
      });
      schema.pre(['insertMany', 'bulkWrite'], async function () { await assertWrite(this); });
      schema.pre('aggregate', async function () {
        if (this.pipeline().some(stage => Object.hasOwn(stage, '$out') || Object.hasOwn(stage, '$merge'))) await pinWrite(this);
      });
      schema.post('aggregate', function (_result, next) { unpinWrite(this).then(() => next(), next); });
      schema.post('aggregate', function (error, _result, next) { unpinWrite(this).then(() => next(error), () => next(error)); });
    });
  }
  return { getState, withShared, withExclusive, middleware, installWriteFence, assertExclusive,
    // Exposed for focused safety tests and adapters, not a public HTTP capability.
    assertWrite };
}
const gate = createArchiveGate();
module.exports = { ...gate, createArchiveGate, READER_LEASE_MS, HEARTBEAT_MS, EXCLUSIVE_LEASE_MS, MAX_READERS };
