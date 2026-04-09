const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
        });

        await user.save();

        // Create token
        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, firstName, lastName, email, role: user.role } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Check user
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Check Role if specified (optional, but good for UI flow)
        if (role && user.role !== role) {
            return res.status(400).json({ msg: 'Invalid Role for this user' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Return token
        const payload = {
            user: {
                id: user.id,
                role: user.role,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email, role: user.role } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route    GET api/auth/google
// @desc     Redirect to Google OAuth consent screen
// @access   Private
const { google } = require('googleapis');
const auth = require('../middleware/auth');

router.get('/google', auth, (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state: req.user.id
    });

    res.json({ url });
});

// @route    GET api/auth/google/callback
// @desc     Handle Google OAuth callback
// @access   Public
router.get('/google/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        
        await User.findByIdAndUpdate(userId, {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token,
            googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
        });

        // Redirect back to frontend calendar page
        res.redirect(`${process.env.FRONTEND_URL}/admin/calendar?sync=success`);
    } catch (err) {
        console.error('Callback error:', err.message);
        res.redirect(`${process.env.FRONTEND_URL}/admin/calendar?sync=error`);
    }
});

module.exports = router;
