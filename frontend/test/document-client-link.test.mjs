import test from 'node:test';
import assert from 'node:assert/strict';
import { documentClientLink } from '../src/utils/documentClientLink.js';

const token = 'c'.repeat(64);
test('document sharing preserves the canonical server URL and complete capability', () => {
  for (const capability of [token, '507f1f77bcf86cd799439011.' + token]) {
    assert.equal(documentClientLink(`https://studio.example.test/quote/${capability}`), `https://studio.example.test/quote/${capability}`);
    assert.equal(documentClientLink(`https://studio.example.test/invoice/${capability}`, 'invoice'), `https://studio.example.test/invoice/${capability}`);
  }
});
test('invalid or unrelated link responses never become client sharing actions', () => {
  for (const value of [undefined, '', '/quote/' + token, 'javascript:alert(1)', `https://user:pass@studio.example.test/quote/${token}`,
    `https://studio.example.test/quote/${token}?token=other`, `https://studio.example.test/quote/${token}#login`,
    `https://studio.example.test/admin/${token}`, 'https://studio.example.test/quote/short']) {
    assert.throws(() => documentClientLink(value), /client link/);
  }
  assert.throws(() => documentClientLink(`https://studio.example.test/quote/${token}`, 'invoice'), /client link/);
});
