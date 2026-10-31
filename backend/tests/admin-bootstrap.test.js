const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoginHandler } = require('../utils/adminBootstrap');

const adminId = '507f1f77bcf86cd79943fe01';
const clientId = '507f1f77bcf86cd79943fe02';
const adminEmail = 'owner@example.test';
const deploymentPassword = 'synthetic-bootstrap-password';
const passwordHash = password => 'test-hash:' + password;
const account = (patch = {}) => ({
  _id: adminId,
  firstName: 'Saved',
  lastName: 'Administrator',
  email: adminEmail,
  role: 'admin',
  password: passwordHash('saved-account-password'),
  googleRefreshToken: 'synthetic-private-provider-token',
  ...patch,
});

function fixture({ users = [], environment = {}, overrides = {} } = {}) {
  const rows = users.map(user => ({ ...user }));
  const state = { rows, lookups: [], indexBuilds: 0, adminChecks: 0, creates: [], hashes: [], comparisons: [], signatures: [] };
  const env = { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: deploymentPassword, JWT_SECRET: 'synthetic-signing-key', ...environment };
  const User = {
    find(query) {
      state.lookups.push(query);
      return {
        async limit(bound) {
          assert.equal(bound, 2, 'lookup must detect ambiguous case variants');
          const matcher = new RegExp(query.email.$regex, query.email.$options);
          return rows.filter(user => matcher.test(user.email)).slice(0, bound);
        },
      };
    },
    async createIndexes() { state.indexBuilds++; },
    async exists(query) {
      state.adminChecks++;
      assert.deepEqual(query, { role: 'admin' });
      return rows.find(user => user.role === 'admin') || null;
    },
    async create(value) {
      state.creates.push(value);
      assert.ok(state.indexBuilds > 0, 'uniqueness must be initialized before creation');
      if (rows.some(user => user.email === value.email)) throw Object.assign(new Error('synthetic duplicate key'), { code: 11000 });
      const user = { _id: adminId, ...value };
      rows.push(user);
      return user;
    },
    ...overrides,
  };
  const handler = createLoginHandler({
    User,
    env,
    hash: async (value, rounds) => {
      state.hashes.push({ value, rounds });
      return passwordHash(value);
    },
    compare: async (value, hashed) => {
      state.comparisons.push({ value, hashed });
      return passwordHash(value) === hashed;
    },
    issueSession: async (user, req, sign, secret) => sign({ user: { id: String(user._id), role: user.role } }, secret, { expiresIn: '30d' }),
    sign(payload, key, options) {
      state.signatures.push({ payload, key, options });
      return 'synthetic-signed-session';
    },
  });
  async function login(body = { email: adminEmail, password: deploymentPassword, role: 'admin' }) {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler({ body }, response);
    return { status: response.statusCode, body: response.body };
  }
  return { state, User, login };
}

test('first configured admin login saves one normalized account and returns only a real saved identity', async () => {
  const { login, state } = fixture({ environment: { ADMIN_EMAIL: ' OWNER@EXAMPLE.TEST ' } });
  const response = await login({ email: ' Owner@Example.Test ', password: deploymentPassword, role: 'admin' });
  assert.equal(response.status, 200);
  assert.equal(state.rows.length, 1);
  assert.equal(state.indexBuilds, 1);
  assert.equal(state.creates[0].email, adminEmail);
  assert.equal(state.creates[0].password, passwordHash(deploymentPassword));
  assert.equal(state.creates[0].role, 'admin');
  assert.equal(state.hashes[0].rounds, 12);
  assert.match(response.body.user.id, /^[a-f\d]{24}$/i);
  assert.equal(response.body.user.id, adminId);
  assert.deepEqual(Object.keys(response.body.user).sort(), ['email', 'firstName', 'id', 'lastName', 'role']);
  assert.equal(JSON.stringify(response.body).includes(deploymentPassword), false);
  assert.equal(JSON.stringify(response.body).includes('synthetic-signing-key'), false);
  assert.deepEqual(state.signatures[0], {
    payload: { user: { id: adminId, role: 'admin' } },
    key: 'synthetic-signing-key',
    options: { expiresIn: '30d' },
  });
});

test('an existing administrator saved password overrides deployment credentials without replacement', async () => {
  const saved = account();
  const { login, state } = fixture({ users: [saved] });
  assert.equal((await login()).status, 400, 'old deployment password must not bypass saved credentials');
  const response = await login({ email: 'OWNER@EXAMPLE.TEST', password: 'saved-account-password', role: 'admin' });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, adminId);
  assert.equal(response.body.user.firstName, 'Saved');
  assert.equal(JSON.stringify(response.body).includes(saved.googleRefreshToken), false);
  assert.deepEqual(state.rows, [saved]);
  assert.equal(state.creates.length, 0);
  assert.equal(state.hashes.length, 0);
  assert.equal(state.indexBuilds, 0);
});

test('an existing client at the configured email is never promoted by deployment credentials', async () => {
  const saved = account({ _id: clientId, role: 'client', password: passwordHash(deploymentPassword) });
  const { login, state } = fixture({ users: [saved] });
  assert.equal((await login()).status, 400, 'requested admin role cannot override saved client role');
  const response = await login({ email: adminEmail, password: deploymentPassword });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, 'client');
  assert.equal(state.signatures[0].payload.user.role, 'client');
  assert.deepEqual(state.rows, [saved]);
  assert.equal(state.creates.length, 0);
});

test('renaming the existing administrator prevents a new account through old deployment credentials', async () => {
  const saved = account({ email: 'renamed-owner@example.test' });
  const { login, state } = fixture({ users: [saved] });
  assert.equal((await login()).status, 400);
  assert.equal(state.adminChecks, 1);
  assert.equal(state.hashes.length, 0);
  assert.equal(state.creates.length, 0);
  assert.equal(state.signatures.length, 0);
  assert.deepEqual(state.rows, [saved]);
});

test('missing or blank bootstrap configuration and wrong credentials cannot create an account', async () => {
  for (const environment of [
    { ADMIN_EMAIL: undefined }, { ADMIN_EMAIL: '  ' },
    { ADMIN_PASSWORD: undefined }, { ADMIN_PASSWORD: '  ' },
  ]) {
    const { login, state } = fixture({ environment });
    assert.equal((await login()).status, 400);
    assert.equal(state.indexBuilds, 0);
    assert.equal(state.creates.length, 0);
    assert.equal(state.signatures.length, 0);
  }
  for (const body of [
    { email: adminEmail, password: deploymentPassword + ' ' },
    { email: 'other@example.test', password: deploymentPassword },
    { email: adminEmail, password: deploymentPassword, role: 'client' },
  ]) {
    const { login, state } = fixture();
    assert.equal((await login(body)).status, 400);
    assert.equal(state.creates.length, 0);
  }
});

test('malformed and NoSQL-shaped login inputs are rejected before user queries', async () => {
  for (const body of [
    null, {}, { email: { $ne: null }, password: deploymentPassword },
    { email: adminEmail, password: { $gt: '' } },
    { email: adminEmail, password: deploymentPassword, role: { $ne: 'client' } },
    { email: 'owner @example.test', password: deploymentPassword },
    { email: 'x'.repeat(255), password: deploymentPassword },
    { email: adminEmail, password: 'x'.repeat(1025) },
    { email: adminEmail, password: deploymentPassword, role: 'x'.repeat(41) },
  ]) {
    const { login, state } = fixture();
    assert.equal((await login(body)).status, 400);
    assert.equal(state.lookups.length, 0);
    assert.equal(state.signatures.length, 0);
  }
});

test('email lookup escapes regex metacharacters and cannot select a lookalike account', async () => {
  const literal = 'owner+film@example.test';
  const saved = account({ email: literal });
  const lookalike = account({ _id: clientId, email: 'ownerrfilm@exampleXtest', role: 'client' });
  const { login, state } = fixture({ users: [saved, lookalike], environment: { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined } });
  const response = await login({ email: literal, password: 'saved-account-password', role: 'admin' });
  assert.equal(response.status, 200);
  const pattern = state.lookups[0].email;
  assert.equal(pattern.$regex, '^owner\\+film@example\\.test$');
  assert.equal(pattern.$options, 'i');
  const regex = new RegExp(pattern.$regex, pattern.$options);
  assert.ok(regex.test(literal));
  assert.equal(regex.test(lookalike.email), false);
  assert.equal(regex.test('prefix-' + literal), false);
});

test('ambiguous legacy case-variant accounts fail closed without choosing an identity', async () => {
  const { login, state } = fixture({ users: [
    account({ password: passwordHash(deploymentPassword) }),
    account({ _id: clientId, email: 'OWNER@EXAMPLE.TEST', role: 'client', password: passwordHash(deploymentPassword) }),
  ] });
  const response = await login();
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { msg: 'Invalid Credentials' });
  assert.equal(state.comparisons.length, 0);
  assert.equal(state.creates.length, 0);
  assert.equal(state.signatures.length, 0);
});

test('index and database failures return a closed generic unavailable response', async () => {
  for (const overrides of [
    { createIndexes: async () => { throw new Error('private-index-diagnostic'); } },
    { find: () => ({ limit: async () => { throw new Error('private-database-diagnostic'); } }) },
    { exists: async () => { throw new Error('private-admin-query-diagnostic'); } },
    { create: async () => { throw new Error('private-create-diagnostic'); } },
  ]) {
    const { login, state } = fixture({ overrides });
    const response = await login();
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { msg: 'Login is temporarily unavailable. Please try again.' });
    assert.equal(JSON.stringify(response.body).includes('private-'), false);
    assert.equal(state.signatures.length, 0);
  }
});

test('duplicate-key recovery uses the winning saved password and role without overwriting', async () => {
  for (const winner of [
    account({ password: passwordHash('different-winning-password') }),
    account({ _id: clientId, role: 'client', password: passwordHash(deploymentPassword) }),
    account({ password: passwordHash(deploymentPassword) }),
  ]) {
    const f = fixture();
    f.User.create = async () => {
      f.state.rows.push(winner);
      throw Object.assign(new Error('synthetic duplicate'), { code: 11000 });
    };
    const response = await f.login();
    const permitted = winner.role === 'admin' && winner.password === passwordHash(deploymentPassword);
    assert.equal(response.status, permitted ? 200 : 400);
    assert.deepEqual(f.state.rows, [winner]);
    assert.equal(f.state.signatures.length, permitted ? 1 : 0);
    if (permitted) assert.equal(response.body.user.id, winner._id);
  }
});

test('concurrent matching first logins converge on one uniquely saved administrator', async () => {
  const { login, state } = fixture();
  const responses = await Promise.all([login(), login()]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(state.rows.length, 1);
  assert.equal(state.creates.length, 2, 'both competing creates are arbitrated by the initialized unique index');
  assert.equal(state.rows[0].email, adminEmail);
  assert.equal(state.rows[0].role, 'admin');
  assert.equal(responses[0].body.user.id, responses[1].body.user.id);
  assert.equal(state.signatures.length, 2);
});

test('ordinary saved clients continue to authenticate using their own account credentials', async () => {
  const saved = account({ _id: clientId, email: 'client@example.test', role: 'client' });
  const { login, state } = fixture({ users: [saved], environment: { ADMIN_EMAIL: undefined, ADMIN_PASSWORD: undefined } });
  const response = await login({ email: ' CLIENT@EXAMPLE.TEST ', password: 'saved-account-password', role: 'client' });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, clientId);
  assert.equal(response.body.user.role, 'client');
  assert.equal(state.indexBuilds, 0);
  assert.equal(state.creates.length, 0);
  assert.deepEqual(state.signatures[0].payload, { user: { id: clientId, role: 'client' } });
});

test('a legacy virtual identity cannot be minted as a saved account session', async () => {
  const { login, state } = fixture({ users: [account({ _id: 'hardcoded-admin-id' })] });
  assert.equal((await login({ email: adminEmail, password: 'saved-account-password' })).status, 503);
  assert.equal(state.signatures.length, 0);
});
