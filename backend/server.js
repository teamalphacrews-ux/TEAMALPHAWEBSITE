// Install before compiling operational models: a verified workspace selects its own database.
require('./saas/tenantModels').installTenantModels();
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
const { createRuntimeReadiness } = require('./utils/runtimeReadiness');
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
const requireAdmin = require('./middleware/requireAdmin');
const { parseProfileUpdate } = require('./utils/profileUpdate');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
if (/^[12]$/.test(process.env.SAAS_TRUST_PROXY_HOPS || '')) app.set('trust proxy', Number(process.env.SAAS_TRUST_PROXY_HOPS));
const readiness = createRuntimeReadiness({
    connect: () => mongoose.connect(process.env.MONGO_URI, { family: 4 }),
    getConnectionState: () => mongoose.connection.readyState,
    models: ['Lead', 'Quotation', 'Invoice', 'StudioContact', 'StudioProject',
        'ContactDocument', 'ProjectMessage', 'QuoteDelivery', 'GmailConnection', 'GmailOAuthNonce',
        'AdminSession', 'StudioBackup', 'RecoveryRecord', 'StudioProfileImage', 'DocumentCounter', 'Task', 'Notification', 'StudioOperationLease',
        'WhatsAppConnection', 'WhatsAppConversation', 'WhatsAppMessage', 'WhatsAppReceipt', 'WabbMessageAttempt', 'StudioPushDevice', 'FinanceReceipt'].map(name => require(`./models/${name}`)).concat(Object.values(require('./saas/models')))
});
app.use(compression()); // Compress all responses
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PATCH"] }
});
const workspaceRealtime = require('./saas/realtime').createWorkspaceRealtime(io);
const scopedIO = workspaceRealtime.scoped;

// Tracks online users for WhatsApp-style ticks
const onlineUsers = new Map();
app.set('onlineUsers', onlineUsers);

// CRITICAL: Attach io instance so routes can access it for real-time broadcasts
app.set('io', scopedIO);

app.use(express.json({
    verify: (req, _res, buffer) => {
        // Meta signs the exact bytes. Keep them only for the WhatsApp webhook.
        const pathname = req.originalUrl.split('?')[0].replace(/\/$/, '');
        if (req.method === 'POST' && ['/api/integrations/whatsapp/webhook', '/api/saas/billing/webhook'].includes(pathname))
            req.rawBody = Buffer.from(buffer);
    }
}));
const allowedOrigins = [
    "https://team-alpha-d64k.onrender.com",
    "https://team-alpha-studio.onrender.com",
    "https://teamalpha.photography",
    process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : null
].filter(Boolean);

const studioCors = cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        // Normalize origin for comparison (remove trailing slash)
        const normalizedOrigin = origin.replace(/\/$/, "");

        // SMART CORS: Allow if in allowedOrigins OR if it's a local network IP (192.168.x.x, 10.x.x.x, 172.x.x.x, localhost)
        const isLocal = normalizedOrigin.match(/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))(:[0-9]+)?$/);

        if (allowedOrigins.includes(normalizedOrigin) || isLocal || allowedOrigins.includes("*")) {
            callback(null, true);
        } else {
            console.log(`Blocked by CORS: ${normalizedOrigin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-auth-token", "Authorization", "x-sheet-id", "x-sheet-name"],
    credentials: true
});
app.use((req, res, next) => {
    // Apple's authorization response is a top-level form POST, not a CORS API call.
    // Only this exact callback bypasses CORS; the one-use state and verified token
    // are still mandatory, and browser proof is required before issuing a session.
    if (req.method === 'POST' && req.path === '/api/saas/oauth/apple/callback') return next();
    return studioCors(req, res, next);
});

// Health remains reachable while the database/indexes initialize; other APIs fail closed.
app.get('/api/health', readiness.health);
app.use('/api', readiness.requireReady);
app.use('/api', require('./saas/access').createWorkspaceMiddleware({ onWorkspace: workspaceRealtime.ensureWorkspace }));
app.use('/api', require('./saas/publicTokens').createPublicWorkspaceMiddleware({ Workspace: require('./saas/models').Workspace }));
// The personal website retains shared support modules without publishing SaaS APIs.
if (process.env.SAAS_ENABLED === 'true') app.use('/api/saas', require('./saas/routes'));

// --- Socket.IO Middleware ---
// Attach socket instance to req so routes can emit events
app.use((req, res, next) => {
    req.io = scopedIO;
    next();
});


const { registerStudioSockets } = require('./realtime/studioSocket');
registerStudioSockets(io, {
    User,
    Message: require('./models/Message'),
    ChatRoom: require('./models/ChatRoom'),
    onlineUsers
});

app.set('io', scopedIO);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d', // Cache for 7 days
    etag: true
}));

readiness.initialize(() => {
    console.log("Database connection and index initialization complete.");
    initCronJobs();
    require('./services/quoteWorkflow').startQuoteWorker();
    const { forEachWorkspace } = require('./saas/workers');
    require('node-cron').schedule('* * * * *',()=>forEachWorkspace(() => require('./services/invoiceDelivery').runInvoiceDeliveryJobs()).catch(()=>console.error('Invoice delivery worker failed.')));
    const settingsJobs = () => {
        forEachWorkspace(workspace => workspace ? require('./saas/service').expireInvitations(workspace._id) : Promise.resolve()).catch(() => console.error('Studio invitation cleanup failed.'));
        forEachWorkspace(() => require('./services/studioRecovery').runBackupJobs()).catch(() => console.error('Studio backup job failed.'));
        forEachWorkspace(() => require('./services/studioAutomation').runStudioAutomation()).catch(() => console.error('Studio notification job failed.'));
    };
    settingsJobs();
    const settingsTimer = setInterval(settingsJobs, 60000);
    settingsTimer.unref();

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

});

const authRouter = express.Router();
authRouter.post('/register', async (req, res) => {
    if (process.env.SAAS_ENABLED === 'true') return res.status(409).json({ msg: 'Create a studio at /signup or use your team invitation.' });
    try {
        const { firstName, lastName, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ firstName, lastName, email, password: hashedPassword });
        await user.save();

        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({ token, user: { id: user.id, firstName, lastName, email, role: user.role } });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "Registration failed" });
    }
});

const { createLoginHandler } = require('./utils/adminBootstrap');
authRouter.post('/login', require('./saas/routes').authLimit, require('./saas/routes').legacyLogin, createLoginHandler({ User }));

authRouter.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('firstName lastName email role galleryTag cloudLink cloudPassword leadId createdAt updatedAt');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

authRouter.put('/profile', auth, async (req, res) => {
    try {
        const updateData = parseProfileUpdate(req.body, req.user.role);
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('firstName lastName email role galleryTag cloudLink cloudPassword leadId createdAt updatedAt');
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ msg: err.message });
        console.error('Profile update failed:', err.message);
        res.status(500).json({ msg: 'Unable to update profile' });
    }
});

// Google OAuth Routes
const { createGoogleOAuthHandlers } = require('./utils/oauthState');
const googleOAuth = createGoogleOAuthHandlers({ User, onConnected: async (user, req) => {
    const { setupGoogleWebhook, pollGoogleCalendar } = require('./services/googleCalendarService');
    await setupGoogleWebhook(user);
    pollGoogleCalendar(user, req.app.get('io'), true).catch(() => {
        console.error('Initial Google calendar synchronization failed.');
    });
} });
authRouter.get('/google', auth, requireAdmin, googleOAuth.start);
authRouter.get('/google/begin', googleOAuth.begin);

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
            console.log(`🔄 Triggering Instant Sync for ${user.email} (via Webhook)`);
            await pollGoogleCalendar(user, req.app.get('io'));
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error.message);
        res.sendStatus(500);
    }
});

authRouter.get('/google/callback', googleOAuth.callback);

app.use('/api/auth', authRouter);
app.use('/api/integrations/gmail', require('./routes/gmailRoutes'));
app.use('/api/integrations/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/studio/security', require('./routes/studioSecurityRoutes'));
app.use('/api/studio', require('./routes/studioPreferencesRoutes'));
app.use('/api/studio', require('./routes/studioProfileRoutes'));
app.use('/api/studio', require('./routes/studioCommunicationRoutes'));
app.use('/api/quotes', require('./routes/publicQuoteRoutes'));
app.use('/api/studio', require('./routes/documentCoverRoutes'));
app.use('/api/studio', require('./routes/quoteWorkflowRoutes'));
app.use('/api/studio/search', require('./routes/workspaceSearchRoutes'));
app.use('/api/studio/devices', require('./routes/studioDeviceRoutes'));
app.use('/api/studio', require('./routes/receiptRoutes'));
app.use('/api/studio', require('./routes/studioRoutes'));
app.use('/api/public-invoices', require('./routes/publicInvoiceRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/chats', chatRoutes);
app.use('/api/project-support', require('./routes/projectSupportRoutes'));
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
app.use('/api/admin-users', require('./routes/adminUserRoutes'));
app.use('/api', require('./routes/contactRoutes'));

// --- Standalone API Configuration ---
// Root route for initial verification
app.get('/', (req, res) => {
    res.json({
        message: "🚀 Team Alpha API is running successfully!",
        version: "1.0.0",
        documentation: "/api/health"
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('-------------------------------------------');
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`🔗 CORS configured for: ${allowedOrigins.join(', ')}`);
    console.log('-------------------------------------------');
});
