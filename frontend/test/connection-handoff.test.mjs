import test from 'node:test';
import assert from 'node:assert/strict';
import { driveConnectionHandoff } from '../src/admin/components/integrations/connectionHandoff.js';

const api = 'https://api.example.com', page = 'https://studio.example.com';
const path = '/api/integrations/drive-backups/begin';
const ticket = 'a'.repeat(64);
test('Drive handoff accepts only the fixed API handoff and a single ticket', () => {
  const url = `${api}${path}?ticket=${ticket}`;
  assert.equal(driveConnectionHandoff({ url }, api, page), url);
  const local = `http://127.0.0.1:5001${path}?ticket=${ticket}`;
  assert.equal(driveConnectionHandoff({ url: local }, '', 'http://127.0.0.1:5192'), local);
});
test('Drive handoff rejects untrusted origins, extra fields and malformed destinations', () => {
  for (const url of [
    `https://untrusted.example${path}?ticket=${ticket}`,
    `http://api.example.com${path}?ticket=${ticket}`,
    `${api}/api/integrations/gmail/begin?ticket=${ticket}`,
    `${api}${path}?ticket=${ticket}&ticket=${ticket}`,
    `${api}${path}?ticket=${ticket}&redirect=https://untrusted.example`,
    `${api}${path}?ticket=${ticket}#fragment`,
    `https://user:password@api.example.com${path}?ticket=${ticket}`,
    `${api}${path}?ticket=short`, 'javascript:alert(1)', '//api.example.com',
  ]) assert.throws(() => driveConnectionHandoff({ url }, api, page));
  for (const value of [null, {}, { url: null }]) assert.throws(() => driveConnectionHandoff(value, api, page));
});
