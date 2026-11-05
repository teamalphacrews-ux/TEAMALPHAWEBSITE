const crypto = require('node:crypto');

function vaultKey(env = process.env) {
    let secret = env.VAULT_SECRET;
    if (!secret && env.NODE_ENV !== 'production') secret = 'AlphaPhotographySecureVaultKey32';
    if (typeof secret === 'string') {
        // Existing raw keys retain their exact bytes, even when they resemble encoded text.
        const raw = Buffer.from(secret, 'utf8');
        if (raw.length === 32) return raw;
        if (/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
            const decoded = Buffer.from(secret, 'base64');
            if (decoded.length === 32 && decoded.toString('base64') === secret) return decoded;
        }
    }
    const error = new Error('Team access vault is unavailable. Configure VAULT_SECRET as 32 raw UTF-8 bytes or the base64 encoding of 32 bytes.');
    error.code = 'VAULT_CONFIGURATION';
    throw error;
}

function encrypt(text, env = process.env) {
    const key = vaultKey(env);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(text, iv, env = process.env) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', vaultKey(env), Buffer.from(iv, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(text, 'hex')), decipher.final()]).toString();
}

module.exports = { vaultKey, encrypt, decrypt };
