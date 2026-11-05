// Route fixtures model saved sessions explicitly. No production auth bypass.
module.exports = function sessionFixture(t) {
  const jwt = require('jsonwebtoken'), security = require('../services/studioSecurity');
  const Session = require('../models/AdminSession'), rows = new Map(), originalSign = jwt.sign;
  t.mock.method(security, 'securityConfig', async () => ({ idleTimeoutMinutes: 60, absoluteSessionHours: 24, permissions: { discounts: 'all_admins', deletion: 'all_admins', exports: 'all_admins', invoiceIssue: 'all_admins' } }));
  t.mock.method(jwt, 'sign', (payload, ...args) => {
    const value = payload?.user?.role === 'admin' && /^[a-f\d]{24}$/i.test(payload.user.id) ? { ...payload, sid: payload.sid || payload.user.id } : payload;
    const token = originalSign(value, ...args);
    if (typeof token === 'string' && value?.sid) rows.set(security.tokenHash(token), { _id: value.sid, user: value.user.id, version: 0, createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 86400000) });
    return token;
  });
  t.mock.method(Session, 'findOne', async query => rows.get(query.tokenHash) || null);
  return rows;
};
