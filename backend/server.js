const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
let compression;
try {
    compression = require('compression');
} catch (error) {
    console.warn('⚠️ Performance warning: `compression` module not found. Run `npm install compression` in the backend directory.');
}
require('dotenv').config();

const User = require('./models/User');
const connectDB = require('./config/db');
const leadRoutes = require('./routes/leadroutes');
const galleryRoutes = require('./routes/galleryRoutes');
const financeRoutes = require('./routes/financeRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const taskRoutes = require('./routes/taskRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { initCronJobs } = require('./services/ReminderService');
const auth = require('./middleware/auth');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
app.use(compression()); // Compress all responses
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// CRITICAL: Attach io instance so routes can access it for real-time broadcasts
app.set('io', io);

app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-auth-token", "Authorization", "x-sheet-id", "x-sheet-name"],
    credentials: true
}));

// --- Socket.IO Middleware ---
// Attach socket instance to req so routes can emit events
app.use((req, res, next) => {
    req.io = io;
    next();
});

io.on('connection', (socket) => {
    // Silent connection

    socket.on('join_chat', (roomId) => {
        socket.join(roomId);
    });

    socket.on('disconnect', (reason) => {
        // Silent disconnect
    });

    socket.on('typing_start', (data) => {
        socket.to(data.roomId).emit('display_typing', data);
    });

    socket.on('typing_stop', (data) => {
        socket.to(data.roomId).emit('hide_typing', data);
    });

    socket.on('message_delivered', async (data) => {
        try {
            const Message = require('./models/Message');
            await Message.findByIdAndUpdate(data.messageId, { status: 'delivered' });
            socket.to(data.senderId).emit('message_status_update', { messageId: data.messageId, status: 'delivered' });
        } catch (err) { }
    });

    socket.on('mark_read', async (data) => {
        try {
            const { roomId, readerType } = data; // roomId is the userId, readerType is 'admin' or 'user'
            const ChatRoom = require('./models/ChatRoom');
            const Message = require('./models/Message');

            // 1. Mark all messages as seen in DB
            const adminIds = ['admin', 'hardcoded-admin-id']; // Simplified for socket logic
            if (readerType === 'admin') {
                await Message.updateMany({ sender: roomId, seen: false }, { $set: { seen: true, status: 'seen' } });
                await ChatRoom.findOneAndUpdate({ userId: roomId }, { $set: { unreadCountAdmin: 0 } });
            } else {
                await Message.updateMany({ recipient: roomId, seen: false }, { $set: { seen: true, status: 'seen' } });
                await ChatRoom.findOneAndUpdate({ userId: roomId }, { $set: { unreadCountUser: 0 } });
            }

            // 2. Fetch updated counts
            const updatedRoom = await ChatRoom.findOne({ userId: roomId });

            // 3. Emit room_updated to sync everyone
            io.emit('room_updated', {
                roomId,
                unreadCountAdmin: updatedRoom?.unreadCountAdmin || 0,
                unreadCountUser: updatedRoom?.unreadCountUser || 0
            });

            // Legacy sync for old components
            socket.broadcast.to(roomId).emit('chat_seen', roomId);
            socket.broadcast.to('admin').emit('chat_seen', roomId);

        } catch (err) {
            console.error('Error in mark_read socket:', err.message);
        }
    });

    socket.on('chat_seen', (data) => {
        const chatId = typeof data === 'string' ? data : data.chatId;
        socket.broadcast.to(chatId).emit('chat_seen', data);
        socket.broadcast.to('admin').emit('chat_seen', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.set('io', io);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d', // Cache for 7 days
    etag: true
}));

connectDB().then(() => {
    console.log("Database connection sequence complete.");
    initCronJobs();

    // --- Google Calendar Polling ---
    const { pollGoogleCalendar } = require('./services/googleCalendarService');
    const User = require('./models/User');

    setInterval(async () => {
        try {
            const connectedUsers = await User.find({
                googleAccessToken: { $exists: true, $ne: null }
            });
            for (const user of connectedUsers) {
                await pollGoogleCalendar(user, io);
            }
        } catch (err) {
            console.error('Error in Google Calendar polling loop:', err.message);
        }
    }, 60000); // Every 60 seconds

}).catch(err => {
    console.error("Delayed Cron initialization due to DB issue:", err.message);
});

const authRouter = express.Router();
authRouter.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ firstName, lastName, email, password: hashedPassword });
        await user.save();

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({ token, user: { id: user.id, firstName, lastName, email, role: user.role } });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Registration failed" });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (
            process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD &&
            email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD
        ) {
            const payload = { user: { id: "hardcoded-admin-id", role: "admin" } };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
            return res.json({
                token,
                user: { id: "hardcoded-admin-id", firstName: "System", lastName: "Admin", email, role: "admin" }
            });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });
        if (role && user.role !== role) return res.status(400).json({ msg: "Invalid Role" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email, role: user.role } });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Login failed" });
    }
});

authRouter.get('/me', auth, async (req, res) => {
    try {
        if (req.user.id === "hardcoded-admin-id") {
            return res.json({ id: "hardcoded-admin-id", firstName: "System", role: "admin" });
        }
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

authRouter.put('/profile', auth, async (req, res) => {
    try {
        const { name, role } = req.body;

        if (req.user.id === "hardcoded-admin-id") {
            // For the system admin in .env, we return the data so the UI updates for the session
            // even though it isn't stored in a specific DB collection.
            const nameParts = (name || "System Admin").trim().split(/\s+/);
            return res.json({
                id: "hardcoded-admin-id",
                firstName: nameParts[0],
                lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
                role: role || "admin",
                msg: "System Admin updated for session"
            });
        }

        let updateData = {};

        if (name) {
            const nameParts = name.trim().split(/\s+/);
            updateData.firstName = nameParts[0];
            updateData.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }

        if (role) {
            updateData.role = role;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!user) return res.status(404).json({ msg: "User not found" });

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Google OAuth Routes
const { google } = require('googleapis');

authRouter.get('/google', auth, (req, res) => {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
            state: req.user.id
        });

        res.json({ url });
    } catch (error) {
        console.error('Google OAuth URL generation error:', error);
        res.status(500).json({ msg: "Failed to generate Google OAuth URL" });
    }
});

authRouter.post('/google/webhook', async (req, res) => {
    const resourceId = req.headers['x-goog-resource-id'];
    const channelId = req.headers['x-goog-channel-id'];
    const syncState = req.headers['x-goog-resource-state'];

    console.log(`📩 Google Webhook Received: [Resource: ${resourceId}] [State: ${syncState}]`);

    if (syncState === 'sync') {
        return res.sendStatus(200); // Initial sync notification
    }

    try {
        const { pollGoogleCalendar } = require('./services/googleCalendarService');
        const user = await User.findOne({ googleResourceId: resourceId, googleWebhookId: channelId });
        if (user) {
            console.log(`🔄 Triggering Instant Sync for ${user.email}`);
            await pollGoogleCalendar(user, req.app.get('io'));
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error.message);
        res.sendStatus(500);
    }
});

authRouter.get('/google/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch Google User Info (specifically email)
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const googleEmail = userInfo.data.email;

        const user = await User.findByIdAndUpdate(userId, {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token,
            googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            googleEmail: googleEmail
        }, { new: true });

        // Register Webhook Channel
        const { setupGoogleWebhook } = require('./services/googleCalendarService');
        await setupGoogleWebhook(user);

        // Redirect back to frontend calendar page
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/admin/calendar?sync=success`);
    } catch (err) {
        console.error('Callback error:', err.message);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/admin/calendar?sync=error`);
    }
});

app.use('/api/auth', authRouter);
app.use('/api/chats', chatRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/photographers', photographerRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/google-sheets', require('./routes/googleSheetRoutes'));
app.use('/api/media', require('./routes/media'));
app.use('/api/drive-gallery', require('./routes/driveGalleryRoutes'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('-------------------------------------------');
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`🔗 Real-time Sockets Enabled`);
    console.log('-------------------------------------------');
});
