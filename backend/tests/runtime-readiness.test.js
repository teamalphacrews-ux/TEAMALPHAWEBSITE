const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRuntimeReadiness } = require('../utils/runtimeReadiness');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function appFor(readiness, onRequest) {
    const router = express.Router();
    router.get('/api/health', readiness.health);
    router.use('/api', readiness.requireReady);
    router.all('/api/studio', (_req, res) => {
        onRequest?.();
        res.json({ ok: true });
    });
    return router;
}

function dispatch(router, url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = { method, url, headers: {} };
        const res = {
            statusCode: 200,
            headers: {},
            set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, headers: this.headers, body }); },
        };
        router.handle(req, res, error => error ? reject(error) : resolve({ status: 404 }));
    });
}

test('pending database and index initialization block API requests and workers until every index succeeds', async () => {
    let state = 0;
    const connection = deferred();
    const lastIndex = deferred();
    const indexStarted = deferred();
    const order = [];
    let workers = 0;
    let requests = 0;
    const readiness = createRuntimeReadiness({
        connect: () => connection.promise,
        getConnectionState: () => state,
        models: [
            { async createIndexes() { order.push('first'); } },
            { async createIndexes() { order.push('last'); indexStarted.resolve(); await lastIndex.promise; } },
        ],
        logger: { error() { assert.fail('Initialization should succeed'); } },
    });
    const app = appFor(readiness, () => { requests++; });
    const pending = readiness.initialize(() => { workers++; order.push('workers'); });
    assert.equal(readiness.initialize(() => { assert.fail('Workers must start only once'); }), pending);
    assert.equal((await dispatch(app, '/api/health')).status, 503);
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        assert.equal((await dispatch(app, '/api/studio', method)).status, 503);
    }
    assert.equal(workers, 0);
    assert.equal(requests, 0);
    state = 1;
    connection.resolve();
    await indexStarted.promise;
    const waiting = await dispatch(app, '/api/health');
    assert.equal(waiting.status, 503);
    assert.equal(waiting.body.database, 'Connected');
    assert.equal(waiting.body.ready, false);
    assert.equal(workers, 0);
    assert.deepEqual(order, ['first', 'last']);
    lastIndex.resolve();
    assert.equal(await pending, true);
    assert.deepEqual(order, ['first', 'last', 'workers']);
    const healthy = await dispatch(app, '/api/health');
    assert.equal(healthy.status, 200);
    assert.equal(healthy.body.ready, true);
    assert.equal(healthy.headers['cache-control'], 'no-store');
    assert.equal((await dispatch(app, '/api/studio', 'POST')).status, 200);
    assert.equal(requests, 1);
    assert.equal(workers, 1);
});

test('index failure keeps health and APIs unavailable without starting workers or exposing database errors', async () => {
    const errors = [];
    let workers = 0;
    let laterIndexes = 0;
    const readiness = createRuntimeReadiness({
        connect: async () => {},
        getConnectionState: () => 1,
        models: [
            { async createIndexes() { throw new Error('private-database-index-detail'); } },
            { async createIndexes() { laterIndexes++; } },
        ],
        logger: { error(message) { errors.push(message); } },
    });
    const app = appFor(readiness, () => assert.fail('Protected handler must not execute'));
    assert.equal(await readiness.initialize(() => { workers++; }), false);
    assert.equal(workers, 0);
    assert.equal(laterIndexes, 0);
    const health = await dispatch(app, '/api/health');
    assert.equal(health.status, 503);
    assert.equal(health.body.database, 'Connected');
    assert.equal(health.body.ready, false);
    const blocked = await dispatch(app, '/api/studio', 'POST');
    assert.equal(blocked.status, 503);
    assert.equal(blocked.headers['retry-after'], '30');
    assert.equal(errors.length, 1);
    assert.ok(!JSON.stringify({ errors, health, blocked }).includes('private-database-index-detail'));
});

test('a later database disconnect immediately makes health and protected APIs unavailable', async () => {
    let state = 1;
    let requests = 0;
    const readiness = createRuntimeReadiness({
        connect: async () => {},
        getConnectionState: () => state,
        models: [{ async createIndexes() {} }],
    });
    const app = appFor(readiness, () => { requests++; });
    await readiness.initialize();
    assert.equal((await dispatch(app, '/api/studio')).status, 200);
    state = 0;
    const health = await dispatch(app, '/api/health');
    assert.equal(health.status, 503);
    assert.equal(health.body.ready, false);
    assert.equal(health.body.database, 'Disconnected');
    assert.equal((await dispatch(app, '/api/studio')).status, 503);
    assert.equal(requests, 1);
});
