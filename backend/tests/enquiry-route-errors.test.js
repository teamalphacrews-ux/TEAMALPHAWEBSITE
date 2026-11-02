const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const Photographer = require('../models/Photographer');
const router = require('../routes/leadroutes');
const handler = (method, path) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('enquiry update errors never disclose private values in responses or diagnostic logs', async t => {
  const secret = 'private-folder-password';
  const body = { name: 'Private client', email: 'client@example.test', notes: 'Confidential planning notes', cloudPassword: secret };
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  let failure;
  t.mock.method(Lead, 'findById', async () => { throw failure; });
  for (const [properties, status, code] of [
    [{}, 503, 'ENQUIRY_UPDATE_FAILED'],
    [{ name: 'ValidationError' }, 400, 'ENQUIRY_UPDATE_INVALID'],
    [{ status: 409 }, 409, 'ENQUIRY_UPDATE_CONFLICT'],
  ]) {
    failure = Object.assign(new Error('Database rejected ' + JSON.stringify(body)), properties);
    const res = response();
    await handler('patch', '/:id')({ params: { id: 'private-id' }, body }, res);
    assert.equal(res.statusCode, status); assert.equal(res.body.code, code);
    assert.equal(JSON.stringify(res.body).includes(secret), false);
    assert.equal(JSON.stringify(res.body).includes('Confidential'), false);
  }
  assert.deepEqual(logs, [
    ['[LEAD_PATCH_ERROR]', { code: 'ENQUIRY_UPDATE_FAILED' }],
    ['[LEAD_PATCH_ERROR]', { code: 'ENQUIRY_UPDATE_INVALID' }],
    ['[LEAD_PATCH_ERROR]', { code: 'ENQUIRY_UPDATE_CONFLICT' }],
  ]);
});

test('legacy crew reminder reports unavailable instead of claiming a reminder was sent', async t => {
  t.mock.method(Lead, 'findById', async () => ({ _id: 'lead1' }));
  t.mock.method(Photographer, 'findOne', async () => ({ _id: 'crew1' }));
  const request = { params: { id: 'lead1', photographerName: 'Crew' } };
  const res = response();
  await handler('post', '/:id/remind/:photographerName')(request, res);
  assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'CREW_REMINDER_UNAVAILABLE');
  assert.match(res.body.error, /No reminder was sent/);
  t.mock.method(Lead, 'findById', async () => { throw new Error('mongodb://private-credentials'); });
  const failed = response();
  await handler('post', '/:id/remind/:photographerName')(request, failed);
  assert.equal(failed.statusCode, 503); assert.equal(JSON.stringify(failed.body).includes('private-credentials'), false);
});
