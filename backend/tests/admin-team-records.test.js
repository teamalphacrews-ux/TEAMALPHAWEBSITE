const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { parseAdminUserInput, emailPattern } = require('../utils/adminUserInput');
const router = require('../routes/adminUserRoutes');
const route = (path, method) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
const member = patch => ({ firstName: '  Yogesh  ', lastName: '', email: ' YOGESH+TEAM@EXAMPLE.TEST ', password: 'synthetic-password', role: 'admin', ...patch });
const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('team member creation supports one-name people and normalizes their email', async () => {
  const parsed = parseAdminUserInput(member());
  assert.equal(parsed.firstName, 'Yogesh'); assert.equal(parsed.lastName, ''); assert.equal(parsed.email, 'yogesh+team@example.test');
  const model = new User(parsed);
  assert.equal(model.validateSync(), undefined);
  const missingLastName = new User({ ...parsed, lastName: undefined });
  assert.equal(missingLastName.lastName, ''); assert.equal(missingLastName.validateSync(), undefined);
  assert.ok(new User({ ...parsed, firstName: '' }).validateSync()?.errors.firstName);
});

test('invalid team data is rejected before account lookups or password processing', async t => {
  t.mock.method(User, 'findOne', () => assert.fail('invalid input must not query accounts'));
  for (const patch of [{ firstName: ' ' }, { email: { $ne: null } }, { email: 'bad-email' }, { role: 'owner' }, { password: 'short' }, { firstName: 'x'.repeat(121) }, { lastName: {} }]) {
    const output = res(); await route('/create', 'post').stack.at(-1).handle({ user: { role: 'admin' }, body: member(patch) }, output);
    assert.equal(output.statusCode, 400);
  }
});

test('existing case-variant emails cannot create a second unusable account', async t => {
  let query;
  t.mock.method(User, 'findOne', async value => { query = value; return { _id: '507f1f77bcf86cd799439011' }; });
  const output = res(); await route('/create', 'post').stack.at(-1).handle({ user: { role: 'admin' }, body: member() }, output);
  assert.equal(output.statusCode, 409);
  const matcher = new RegExp(query.email.$regex, query.email.$options);
  assert.equal(matcher.test('YOGESH+TEAM@EXAMPLE.TEST'), true);
  assert.equal(matcher.test('yogeshhteam@exampleXtest'), false);
  assert.equal(matcher.test('prefix-yogesh+team@example.test'), false);
  assert.equal(emailPattern('name+studio@example.test'), '^name\\+studio@example\\.test$');
});

test('editing prevents duplicate email identities without changing the account', async t => {
  let saved = false;
  const account = { _id: '507f1f77bcf86cd799439011', save: async () => { saved = true; } };
  t.mock.method(User, 'findById', async () => account);
  t.mock.method(User, 'findOne', async query => { assert.equal(query._id.$ne, account._id); return { _id: 'another' }; });
  const output = res(); await route('/:id', 'put').stack.at(-1).handle({ user: { role: 'admin' }, params: { id: account._id }, body: { email: ' DUPLICATE@EXAMPLE.TEST ' } }, output);
  assert.equal(output.statusCode, 409); assert.equal(saved, false);
});

test('partial updates preserve an unchanged password and validate any replacement', () => {
  assert.deepEqual(parseAdminUserInput({ lastName: '', password: '' }, { partial: true }), { lastName: '' });
  assert.deepEqual(parseAdminUserInput({ password: '••••••••' }, { partial: true }), {});
  assert.throws(() => parseAdminUserInput({ password: 'short' }, { partial: true }), error => error.status === 400);
  assert.throws(() => parseAdminUserInput({ role: { $ne: null } }, { partial: true }), error => error.status === 400);
});

test('a second administrator cannot bypass owner-only account changes', async t => {
  t.mock.method(User, 'findById', () => ({ select: async () => ({ role: 'admin', studioOwner: false, email: 'staff@example.test' }) }));
  for (const [path, method] of [['/create', 'post'], ['/:id', 'put'], ['/:id', 'delete']]) {
    const output = res(); let next = false;
    await route(path, method).stack[1].handle({ user: { id: '507f1f77bcf86cd799439011', role: 'admin' } }, output, () => { next = true; });
    assert.equal(output.statusCode, 403); assert.equal(next, false);
  }
});
