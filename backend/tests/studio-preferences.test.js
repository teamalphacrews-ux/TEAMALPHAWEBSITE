const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePreferences, defaults, CARD_IDS } = require('../utils/studioPreferences');
test.beforeEach(require('./sessionFixture'));
test('overview preferences allow an intentionally empty overview and reject unknown cards, duplicates and privilege fields', () => {
  assert.deepEqual(parsePreferences({ visibleCards: [] }), { visibleCards: [] });
  assert.equal(defaults().visibleCards.length, 11);
  for (const body of [null, [], { theme: 'midnight' }, { visibleCards: ['private-client-record'] }, { visibleCards: [CARD_IDS[0], CARD_IDS[0]] }, { role: 'admin' }, { userId: 'another-account' }, { visibleCards: '__proto__' }]) assert.throws(() => parsePreferences(body), error => error.status === 400);
  const original = defaults(); original.visibleCards.pop(); assert.equal(defaults().visibleCards.length, 11);
});
test('appearance updates are scoped to the signed-in saved account and do not change studio-wide settings', async t => {
  const jwt = require('jsonwebtoken'), User = require('../models/User');
  const id = '507f1f77bcf86cd79943fd01'; process.env.JWT_SECRET = 'preferences-test-secret';
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: id, role: 'admin', sessionVersion: 0, studioPreferences: defaults() }) }));
  let captured;
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ select: async () => { captured = { filter, update }; return { studioPreferences: { theme: 'dark', visibleCards: [] } }; } }));
  const token = jwt.sign({ user: { id, role: 'admin' } }, process.env.JWT_SECRET);
  const router = require('../routes/studioPreferencesRoutes');
  const result = await new Promise((resolve, reject) => router.handle({ method: 'PATCH', url: '/preferences', body: { theme: 'dark', visibleCards: [] }, headers: { authorization: 'Bearer ' + token }, header: name => name.toLowerCase() === 'authorization' ? 'Bearer ' + token : undefined }, { set() {}, status(status) { this.statusCode = status; return this; }, json(body) { resolve({ status: this.statusCode || 200, body }); } }, reject));
  assert.equal(result.status, 200); assert.equal(captured.filter._id, id); assert.equal(captured.filter.role, 'admin');
  assert.deepEqual(captured.update, { $set: { 'studioPreferences.theme': 'dark', 'studioPreferences.visibleCards': [] } });
  assert.deepEqual(result.body.preferences.visibleCards, []);
});
