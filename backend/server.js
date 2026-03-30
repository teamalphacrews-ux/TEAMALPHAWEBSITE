const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
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
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(cors());

// --- Socket.IO Middleware ---
// Attach socket instance to req so routes can emit events
app.use((req, res, next) => {
    req.io = io;
    next();
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_chat', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
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

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.set('io', io);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

connectDB().then(() => {
    console.log("Database connection sequence complete.");
    initCronJobs();
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('-------------------------------------------');
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`🔗 Real-time Sockets Enabled`);
    console.log('-------------------------------------------');
});
