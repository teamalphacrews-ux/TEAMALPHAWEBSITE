const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const invalidCredentials = () => Object.assign(new Error('Invalid Credentials'), { loginStatus: 400 });
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sameSecret(left, right) {
    const digest = value => crypto.createHash('sha256').update(value).digest();
    return crypto.timingSafeEqual(digest(left), digest(right));
}

function createLoginHandler({
    User = require('../models/User'), env = process.env,
    hash = bcrypt.hash, compare = bcrypt.compare, sign = jwt.sign,
} = {}) {
    async function findAccount(email) {
        // Legacy emails were not normalized. Never choose between two case
        // variants or mistake an existing client for a new administrator.
        const matches = await User.find({
            email: { $regex: '^' + escapeRegex(email) + '$', $options: 'i' },
        }).limit(2);
        if (matches.length > 1) throw invalidCredentials();
        return matches[0] || null;
    }

    async function authenticate(user, password, requestedRole) {
        if (requestedRole && user.role !== requestedRole) throw invalidCredentials();
        if (!await compare(password, user.password)) throw invalidCredentials();
        return user;
    }

    return async function login(req, res) {
        try {
            const { email: inputEmail, password, role } = req.body || {};
            const email = normalizeEmail(inputEmail);
            if (!email || email.length > 254 || /\s/.test(email) ||
                typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024 ||
                (role !== undefined && (typeof role !== 'string' || role.length > 40))) {
                throw invalidCredentials();
            }

            let user = await findAccount(email);
            if (user) {
                // Saved passwords and roles always win over deployment values.
                await authenticate(user, password, role);
            } else {
                const configuredEmail = normalizeEmail(env.ADMIN_EMAIL);
                const configuredPassword = env.ADMIN_PASSWORD;
                if (!configuredEmail || typeof configuredPassword !== 'string' || !configuredPassword.trim() ||
                    email !== configuredEmail || !sameSecret(password, configuredPassword) ||
                    (role && role !== 'admin')) {
                    throw invalidCredentials();
                }

                // Ensure uniqueness even when reached through the legacy router
                // or mongoose automatic index creation is disabled.
                await User.createIndexes();
                user = await findAccount(email);
                if (user) {
                    await authenticate(user, password, role);
                } else {
                    // Renaming an existing administrator must not leave the
                    // deployment credentials as a second account entry point.
                    if (await User.exists({ role: 'admin' })) throw invalidCredentials();
                    const passwordHash = await hash(password, 12);
                    try {
                        user = await User.create({
                            firstName: 'System', lastName: 'Admin', email,
                            password: passwordHash, role: 'admin',
                        });
                    } catch (error) {
                        if (error.code !== 11000) throw error;
                        user = await findAccount(email);
                        if (!user) throw error;
                        // A concurrent winner's password and role still win.
                        await authenticate(user, password, role);
                    }
                    // Reject ambiguous legacy case-variant registration races.
                    user = await findAccount(email);
                    if (!user) throw invalidCredentials();
                    await authenticate(user, password, role);
                }
            }

            const id = String(user._id || user.id);
            if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Saved account identity required');
            const token = sign({ user: { id, role: user.role } }, env.JWT_SECRET, { expiresIn: '30d' });
            return res.json({ token, user: {
                id, firstName: user.firstName, lastName: user.lastName,
                email: user.email, role: user.role,
            } });
        } catch (error) {
            if (error.loginStatus === 400) return res.status(400).json({ msg: 'Invalid Credentials' });
            return res.status(503).json({ msg: 'Login is temporarily unavailable. Please try again.' });
        }
    };
}

module.exports = { createLoginHandler };
