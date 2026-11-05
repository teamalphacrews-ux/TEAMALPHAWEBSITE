const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const security = require('../services/studioSecurity');
const archiveRouter = require('../routes/studioArchiveRoutes');
const securityRouter = require('../routes/studioSecurityRoutes');

function request(app, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = '/api/studio/security' + path;
    req.headers = {};
    const res = new http.ServerResponse(req);
    res.json = function (body) { resolve({ status: this.statusCode, body }); return this; };
    app.handle(req, res, error => error ? reject(error) : resolve({ status: 404 }));
  });
}

test('archive routes preserve administrator security access and keep recovery owner-only', { timeout: 5000 }, async t => {
  const user = { id: '507f1f77bcf86cd799439011', role: 'admin', studioOwner: false, moduleAccess: null };
  for (const router of [archiveRouter, securityRouter]) {
    for (const layer of router.stack) {
      if (layer.handle.name === 'auth') t.mock.method(layer, 'handle', (req, _res, next) => { req.user = user; next(); });
    }
  }
  let ownerChecks = 0;
  t.mock.method(security, 'isOwner', async () => false);
  t.mock.method(security, 'securityConfig', async () => ({ permissions: { exports: 'owner_only' } }));
  t.mock.method(security, 'assertOwner', async () => {
    ownerChecks++;
    throw security.fail('Only the studio owner can manage workspace recovery.', 403);
  });
  const app = express();
  // Production order: archive middleware must not intercept the legacy router.
  app.use('/api/studio/security', archiveRouter);
  app.use('/api/studio/security', securityRouter);
  const access = await request(app, '/access');
  assert.equal(access.status, 200);
  assert.equal(access.body.owner, false);
  assert.equal(access.body.permissions.exports, false);
  assert.equal(ownerChecks, 0);

  const passthrough = express();
  passthrough.use('/api/studio/security', archiveRouter);
  passthrough.use((_req, res) => res.json({ legacy: true }));
  for (const [path, method] of [['/sessions', 'GET'], ['/activity', 'POST'], ['/logout', 'POST']]) {
    const result = await request(passthrough, path, method);
    assert.deepEqual(result, { status: 200, body: { legacy: true } });
  }
  assert.equal(ownerChecks, 0);
  for (const [path, method] of [
    ['/workspace-data', 'GET'], ['/workspace-backups', 'GET'], ['/workspace-backups', 'POST'],
    ['/workspace-backups/507f1f77bcf86cd799439011/download', 'GET'],
    ['/workspace-restore/inspect', 'POST'], ['/workspace-restore', 'POST'],
    ['/workspace-reset', 'POST'], ['/workspace-resume', 'POST'],
  ]) {
    const result = await request(app, path, method);
    assert.equal(result.status, 403, path);
  }
  assert.equal(ownerChecks, 8);
});
