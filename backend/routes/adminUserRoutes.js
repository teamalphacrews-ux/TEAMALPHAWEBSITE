const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lead = require('../models/Lead');
const AdminSettings = require('../models/AdminSettings');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/vaultCrypto');
const { assertOwner, isOwner } = require('../services/studioSecurity');
const { parseAdminUserInput, emailPattern } = require('../utils/adminUserInput');
const requireOwner = async (req, res, next) => { try { await assertOwner(req.user.id); next(); } catch (e) { res.status(e.status || 503).json({ msg: e.status ? e.message : 'Account permission checks are unavailable.' }); } };

// @route   GET api/admin-users
// @desc    Get all users (Client/Admin) with decrypted passwords
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    try {
        const users = await User.find().sort({ createdAt: -1 });
        const owner = await isOwner(req.user.id);
        
        const decryptedUsers = users.map(u => {
            let decryptedPass = '';
            if (owner && u.vaultPassword && u.iv) {
                try {
                    decryptedPass = decrypt(u.vaultPassword, u.iv);
                } catch (e) {
                    if (e.code === 'VAULT_CONFIGURATION') throw e;
                    decryptedPass = 'Error';
                }
            }
            // Create a plain object and add the password
            const raw = u.toObject();
            const publicFields = ['_id', 'firstName', 'lastName', 'email', 'role', 'galleryTag', 'cloudLink', 'leadId', 'createdAt', 'updatedAt'];
            const userObj = Object.fromEntries(publicFields.filter(key => raw[key] !== undefined).map(key => [key, raw[key]]));
            if (owner) userObj.cloudPassword = raw.cloudPassword || '';
            userObj.plainPassword = decryptedPass;
            return userObj;
        });

        res.json(decryptedUsers);
    } catch (err) {
        if (err.code === 'VAULT_CONFIGURATION') return res.status(503).json({ msg: err.message });
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/admin-users/create
// @desc    Create new user from scratch or CRM lead
// @access  Private (Admin only)
router.post('/create', auth, requireOwner, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    
    try {
        const { firstName, lastName, email, password, role } = parseAdminUserInput(req.body);
        const { leadId, cloudLink, cloudPassword } = req.body;
        let user = await User.findOne({ email: { $regex: emailPattern(email), $options: 'i' } });
        if (user) return res.status(409).json({ msg: 'An account already uses this email address.' });

        // Hash for auth
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Encrypt for vault
        const { iv, encryptedData } = encrypt(password);

        user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: role || 'client',
            leadId: leadId || null,
            vaultPassword: encryptedData,
            iv: iv,
            cloudLink: cloudLink || '',
            cloudPassword: cloudPassword || ''
        });

        await user.save();
        res.json({ msg: 'User created successfully', user: { id: user._id, firstName, lastName, email, role: user.role } });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ msg: err.message });
        if (err.code === 11000) return res.status(409).json({ msg: 'An account already uses this email address.' });
        if (err.code === 'VAULT_CONFIGURATION') return res.status(503).json({ msg: err.message });
        console.error(err);
        res.status(500).json({ msg: 'Failed to create user' });
    }
});

// @route   PUT api/admin-users/:id
// @desc    Update user details and credentials
// @access  Private (Admin only)
router.put('/:id', auth, requireOwner, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    
    try {
        const update = parseAdminUserInput(req.body, { partial: true });
        const { firstName, lastName, email, role, password } = update;
        const { cloudLink, cloudPassword } = req.body;
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (email && await User.findOne({ _id: { $ne: user._id }, email: { $regex: emailPattern(email), $options: 'i' } })) return res.status(409).json({ msg: 'An account already uses this email address.' });
        const ownerAccount = await isOwner(user._id);
        const credentialsChanged = password || (role && role !== user.role);
        if (ownerAccount && role && role !== 'admin') return res.status(400).json({ msg: 'The studio owner must remain an administrator.' });
        if (role && !['admin', 'client'].includes(role)) return res.status(400).json({ msg: 'Invalid account role.' });
        if (ownerAccount) user.studioOwner = true;

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (email) user.email = email;
        if (role) user.role = role;
        if (cloudLink !== undefined) user.cloudLink = cloudLink;
        if (cloudPassword !== undefined) user.cloudPassword = cloudPassword;
        
        // If password is changed, update both hash and vault
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            
            const { iv, encryptedData } = encrypt(password);
            user.vaultPassword = encryptedData;
            user.iv = iv;
        }

        await user.save();
        if (credentialsChanged) await require('../models/AdminSession').updateMany({ user: user._id }, { $set: { revokedAt: new Date() } });
        res.json({ msg: 'User updated successfully' });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ msg: err.message });
        if (err.code === 11000) return res.status(409).json({ msg: 'An account already uses this email address.' });
        if (err.code === 'VAULT_CONFIGURATION') return res.status(503).json({ msg: err.message });
        res.status(500).json({ msg: 'Update failed' });
    }
});

// @route   POST api/admin-users/update-master
// @desc    Change the master password
// @access  Private (Admin only)
router.post('/update-master', auth, requireOwner, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    
    const { currentPassword, newPassword } = req.body;
    try {
        const settings = await AdminSettings.findOne();
        if (!settings) return res.status(404).json({ msg: 'Master password not setup' });

        const isMatch = await bcrypt.compare(currentPassword, settings.masterPasswordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Current master password incorrect' });

        const salt = await bcrypt.genSalt(10);
        settings.masterPasswordHash = await bcrypt.hash(newPassword, salt);
        settings.lastUpdated = Date.now();
        
        await settings.save();
        res.json({ msg: 'Master password updated successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Master password update failed' });
    }
});

// @route   DELETE api/admin-users/:id
// @desc    Delete a user
// @access  Private (Admin only)
router.delete('/:id', auth, requireOwner, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    try {
        if (await isOwner(req.params.id)) return res.status(400).json({ msg: 'The studio owner account cannot be deleted.' });
        await require('../models/AdminSession').updateMany({ user: req.params.id }, { $set: { revokedAt: new Date() } });
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Delete failed' });
    }
});

module.exports = router;
