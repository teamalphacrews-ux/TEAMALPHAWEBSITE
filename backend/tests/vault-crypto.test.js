const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { vaultKey, encrypt, decrypt } = require('../utils/vaultCrypto');

const rawSecret = '0123456789abcdef0123456789abcdef';
const production = secret => ({ NODE_ENV: 'production', VAULT_SECRET: secret });
const plaintext = 'Synthetic studio password — नमस्ते';

test('existing raw 32-byte keys preserve exact key bytes and legacy AES-CBC ciphertext', () => {
    const env = production(rawSecret);
    assert.deepEqual(vaultKey(env), Buffer.from(rawSecret));
    const result = encrypt(plaintext, env);
    assert.match(result.iv, /^[a-f\d]{32}$/);
    const legacy = crypto.createCipheriv('aes-256-cbc', Buffer.from(rawSecret), Buffer.from(result.iv, 'hex'));
    const legacyCiphertext = Buffer.concat([legacy.update(plaintext), legacy.final()]).toString('hex');
    assert.equal(result.encryptedData, legacyCiphertext);
    assert.equal(decrypt(legacyCiphertext, result.iv, env), plaintext);
});

test('canonical base64 256-bit Render secrets roundtrip and match equivalent raw key bytes', () => {
    const bytes = Buffer.from(rawSecret);
    const encoded = bytes.toString('base64');
    assert.equal(encoded.length, 44);
    assert.deepEqual(vaultKey(production(encoded)), bytes);
    const result = encrypt(plaintext, production(encoded));
    assert.equal(decrypt(result.encryptedData, result.iv, production(encoded)), plaintext);
    assert.equal(decrypt(result.encryptedData, result.iv, production(rawSecret)), plaintext);
    const randomKey = crypto.randomBytes(32);
    assert.deepEqual(vaultKey(production(randomKey.toString('base64'))), randomKey);
});

test('raw UTF-8 byte length wins and base64-looking raw keys are never silently decoded', () => {
    const multibyte = 'é'.repeat(16);
    assert.deepEqual(vaultKey(production(multibyte)), Buffer.from(multibyte));
    const encodedLookingRaw = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    assert.deepEqual(vaultKey(production(encodedLookingRaw)), Buffer.from(encodedLookingRaw));
    const result = encrypt(plaintext, production(multibyte));
    assert.equal(decrypt(result.encryptedData, result.iv, production(multibyte)), plaintext);
});

test('invalid, noncanonical and wrongly sized encoded secrets fail without exposing their value', () => {
    const canonical = Buffer.alloc(32, 0).toString('base64');
    const noncanonical = canonical.slice(0, 42) + 'B=';
    for (const value of [null, 42, 'too-short-secret', 'é'.repeat(32), canonical + '\n', canonical.slice(0, -1), noncanonical, Buffer.alloc(31).toString('base64'), Buffer.alloc(33).toString('base64'), ' '.repeat(44)]) {
        assert.throws(() => vaultKey(production(value)), error => {
            assert.equal(error.code, 'VAULT_CONFIGURATION');
            if (typeof value === 'string' && value.trim()) assert.equal(error.message.includes(value), false);
            return true;
        });
    }
});

test('missing production key fails at operation time; development fallback stays compatible', () => {
    assert.doesNotThrow(() => require('../utils/vaultCrypto'));
    for (const operation of [() => vaultKey({ NODE_ENV: 'production' }), () => encrypt(plaintext, { NODE_ENV: 'production' }), () => decrypt('00', '00', { NODE_ENV: 'production' })]) {
        assert.throws(operation, { code: 'VAULT_CONFIGURATION' });
    }
    assert.deepEqual(vaultKey({ NODE_ENV: 'development' }), Buffer.from('AlphaPhotographySecureVaultKey32'));
    const result = encrypt(plaintext, { NODE_ENV: 'development' });
    assert.equal(decrypt(result.encryptedData, result.iv, { NODE_ENV: 'development' }), plaintext);
});
