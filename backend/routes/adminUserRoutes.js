const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lead = require('../models/Lead');
const AdminSettings = require('../models/AdminSettings');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.VAULT_SECRET || 'AlphaPhotographySecureVaultKey32'; // Must be 32 chars
const IV_LENGTH = 16;

// Utility functions for encryption
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(text, iv) {
    const ivBuffer = Buffer.from(iv, 'hex');
    const encryptedText = Buffer.from(text, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), ivBuffer);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// @route   GET api/admin-users
// @desc    Get all users (Client/Admin) with decrypted passwords
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    try {
        const users = await User.find().sort({ createdAt: -1 });
        
        const decryptedUsers = users.map(u => {
            let decryptedPass = '';
            if (u.vaultPassword && u.iv) {
                try {
                    decryptedPass = decrypt(u.vaultPassword, u.iv);
                } catch (e) {
                    decryptedPass = 'Error';
                }
            }
            // Create a plain object and add the password
            const userObj = u.toObject();
            delete userObj.password;
            delete userObj.vaultPassword;
            delete userObj.iv;
            userObj.plainPassword = decryptedPass;
            return userObj;
        });

        res.json(decryptedUsers);
    } catch (err) {
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST api/admin-users/create
// @desc    Create new user from scratch or CRM lead
// @access  Private (Admin only)
router.post('/create', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    
    const { firstName, lastName, email, password, role, leadId, cloudLink, cloudPassword } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists with this email' });

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
        console.error(err);
        res.status(500).json({ msg: 'Failed to create user' });
    }
});

// @route   PUT api/admin-users/:id
// @desc    Update user details and credentials
// @access  Private (Admin only)
router.put('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    
    const { firstName, lastName, email, role, password, cloudLink, cloudPassword } = req.body;

    try {
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (email) user.email = email;
        if (role) user.role = role;
        if (cloudLink !== undefined) user.cloudLink = cloudLink;
        if (cloudPassword !== undefined) user.cloudPassword = cloudPassword;
        
        // If password is changed, update both hash and vault
        if (password && password !== '••••••••') {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            
            const { iv, encryptedData } = encrypt(password);
            user.vaultPassword = encryptedData;
            user.iv = iv;
        }

        await user.save();
        res.json({ msg: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ msg: 'Update failed' });
    }
});

// @route   POST api/admin-users/update-master
// @desc    Change the master password
// @access  Private (Admin only)
router.post('/update-master', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        res.status(500).json({ msg: 'Delete failed' });
    }
});

module.exports = router;
