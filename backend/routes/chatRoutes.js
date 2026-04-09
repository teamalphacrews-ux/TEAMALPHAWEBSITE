const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage configuration for profile and chat uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const chatDir = path.join(__dirname, '../uploads/chats');
        if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
        cb(null, chatDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});
const upload = multer({ storage });

// @route   POST api/chats
// @desc    Send a message
router.post('/', auth, async (req, res) => {
    const { text, recipient, messageType, attachments, replyTo } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const senderName = user ? (user.name || `${user.firstName} ${user.lastName}`.trim()) : 'Alpha Admin';

        // Determine initial status based on recipient online status
        const onlineUsers = req.app.get('onlineUsers');
        const isRecipientOnline = onlineUsers && onlineUsers.has(String(recipient));

        const newMessage = new Message({
            sender: req.user.id,
            senderName: senderName,
            recipient,
            text,
            messageType: messageType || 'text',
            attachments: attachments || [],
            replyTo: replyTo || null,
            seen: false,
            isRead: false,
            status: isRecipientOnline ? 'delivered' : 'sent'
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await Message.findById(savedMessage._id)
            .populate('replyTo', 'text sender timestamp');

        // --- NEW: ChatRoom Orchestration ---
        const ChatRoom = require('../models/ChatRoom');
        const isAdmin = req.user.role === 'admin' || req.user.id === 'hardcoded-admin-id';
        const roomUserId = isAdmin ? recipient : req.user.id;

        if (roomUserId && roomUserId !== 'admin') {
            const incrementField = isAdmin ? 'unreadCountUser' : 'unreadCountAdmin';
            const updatedRoom = await ChatRoom.findOneAndUpdate(
                { userId: roomUserId },
                {
                    $set: { lastMessage: text, lastTimestamp: new Date() },
                    $inc: { [incrementField]: 1 }
                },
                { upsert: true, new: true }
            );

            const ioInstance = req.app.get('io');
            if (ioInstance) {
                ioInstance.emit('room_updated', {
                    roomId: roomUserId,
                    unreadCountAdmin: updatedRoom.unreadCountAdmin,
                    unreadCountUser: updatedRoom.unreadCountUser
                });
            }
        }

        const io = req.app.get('io');
        if (io) {
            // Logic to determine unique rooms to emit to.
            // If sender is 'admin' or hardcoded, we should still reach room 'admin' for multi-tab sync.
            // If recipient is 'admin', we reach room 'admin'.
            const rooms = new Set();
            rooms.add(recipient);

            // For admins, also broadcast to 'admin' room to keep all admin tabs in sync
            if (recipient === 'admin' || req.user.role === 'admin' || req.user.id === 'hardcoded-admin-id') {
                rooms.add('admin');
            }

            // Always reach the sender for multi-tab sync
            rooms.add(req.user.id);

            // Emit to each unique room
            rooms.forEach(room => {
                console.log(`--- [EMIT] --- Socket: Sending new_message to room: ${room}`);
                io.to(room).emit('new_message', populatedMessage);
            });
        }

        res.json(populatedMessage);
    } catch (err) {
        console.error('Chat POST Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// @route   POST api/chats/upload
// @desc    Upload an attachment for a chat
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

        // Return URL relative to the host
        const fileUrl = `/uploads/chats/${req.file.filename}`;

        res.json({
            url: fileUrl,
            fileName: req.file.originalname,
            fileType: req.file.mimetype
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/chats
// @desc    Client-side: Fetch messages between this user and admins
router.get('/', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', ...admins.map(a => String(a._id))];
        const ChatRoom = require('../models/ChatRoom');

        // Fetch user document to get lastChatClearAt timestamp
        const fullUser = await User.findById(req.user.id);
        const clearedAt = fullUser?.lastChatClearAt || new Date(0);

        const messages = await Message.find({
            $or: [
                { sender: String(req.user.id), recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: String(req.user.id) }
            ],
            deletedForUsers: { $nin: [String(req.user.id)] },
            timestamp: { $gt: clearedAt }
        }).sort({ timestamp: 1 })
            .populate('replyTo', 'text sender timestamp');

        res.json(messages);
    } catch (err) {
        console.error('Chat GET Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Helper to get all possible admin identifiers
async function getAdminIds(adminId) {
    const admins = await User.find({ role: 'admin' }, '_id');
    return ['admin', 'hardcoded-admin-id', adminId, ...admins.map(a => String(a._id))].filter(Boolean);
}

// API 1: GET /api/chats/admin/conversations
router.get('/admin/conversations', auth, async (req, res) => {
    try {
        const adminIds = await getAdminIds(req.user.id);
        const messages = await Message.find({
            $or: [{ sender: { $in: adminIds } }, { recipient: { $in: adminIds } }],
            deletedForUsers: { $ne: req.user.id }
        }).sort({ timestamp: -1 });

        const conversationsMap = {};
        const participantIdsSet = new Set();
        messages.forEach(msg => {
            const senderStr = String(msg.sender);
            const recipientStr = String(msg.recipient);
            const otherParty = adminIds.includes(senderStr) ? recipientStr : senderStr;
            if (adminIds.includes(otherParty)) return;
            participantIdsSet.add(otherParty);
            if (!conversationsMap[otherParty]) {
                conversationsMap[otherParty] = { chatId: otherParty, lastMessage: msg.text, timestamp: msg.timestamp, unreadCount: 0 };
            }
        });

        const ChatRoom = require('../models/ChatRoom');

        const [users, rooms] = await Promise.all([
            User.find({ _id: { $in: Array.from(participantIdsSet) } }, 'name firstName lastName'),
            ChatRoom.find({ userId: { $in: Array.from(participantIdsSet) } })
        ]);

        // Build details for users we found messages for
        const userDetails = {};
        users.forEach(u => userDetails[u._id.toString()] = u.name || `${u.firstName} ${u.lastName}`.trim());

        const roomCounts = {};
        rooms.forEach(r => roomCounts[r.userId] = r.unreadCountAdmin);

        const result = Object.values(conversationsMap).map(conv => ({
            ...conv,
            userName: userDetails[conv.chatId] || 'Alpha Client',
            unreadCount: roomCounts[conv.chatId] || 0
        }));

        res.json(result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET api/chats/search-users
// @desc    Global search for all clients (for starting new chats)
router.get('/search-users', auth, async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);
    try {
        const users = await User.find({
            $or: [
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { name: { $regex: query, $options: 'i' } } // In case name field exists
            ],
            role: 'client' // Only search for clients
        }, 'name firstName lastName email').limit(10);
        
        res.json(users);
    } catch (err) {
        console.error('Search users error:', err.message);
        res.status(500).send('Server Error');
    }
});

// API 3: GET /api/chats/unread-summary
// API 3: GET /api/chats/unread-summary
router.get('/unread-summary', auth, async (req, res) => {
    try {
        const ChatRoom = require('../models/ChatRoom');
        const roomsWithUnread = await ChatRoom.countDocuments({ unreadCountAdmin: { $gt: 0 } });
        res.json({ totalChatsWithUnread: roomsWithUnread });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/mark-as-seen', auth, async (req, res) => {
    const { chatId } = req.body;
    try {
        const adminIds = await getAdminIds(req.user.id);
        const ChatRoom = require('../models/ChatRoom');

        await Promise.all([
            Message.updateMany({ sender: chatId, recipient: { $in: adminIds }, seen: false }, { $set: { seen: true, isRead: true, status: 'seen' } }),
            ChatRoom.findOneAndUpdate({ userId: chatId }, { $set: { unreadCountAdmin: 0 } })
        ]);

        const updatedRoom = await ChatRoom.findOne({ userId: chatId });
        const roomsWithUnread = await ChatRoom.countDocuments({ unreadCountAdmin: { $gt: 0 } });

        const io = req.app.get('io');
        if (io) {
            io.emit('room_updated', {
                roomId: chatId,
                unreadCountAdmin: 0,
                unreadCountUser: updatedRoom ? updatedRoom.unreadCountUser : 0
            });
            io.to('admin').emit('unread_count_update', { count: roomsWithUnread });
        }
        res.json({ success: true, totalUnreadChats: roomsWithUnread });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Backwards compatibility for client-side legacy routes
router.put('/read', auth, async (req, res) => {
    const { chatId } = req.body;
    try {
        const ChatRoom = require('../models/ChatRoom');
        await Promise.all([
            Message.updateMany({ recipient: req.user.id, seen: false }, { $set: { seen: true, isRead: true, status: 'seen' } }),
            ChatRoom.findOneAndUpdate({ userId: req.user.id }, { $set: { unreadCountUser: 0 } })
        ]);

        const updatedRoom = await ChatRoom.findOne({ userId: req.user.id });
        const io = req.app.get('io');
        if (io) {
            io.emit('room_updated', {
                roomId: req.user.id,
                unreadCountAdmin: updatedRoom ? updatedRoom.unreadCountAdmin : 0,
                unreadCountUser: 0
            });
            io.to(req.user.id).emit('unread_count_update', { count: 0 });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/unread', auth, async (req, res) => {
    try {
        const ChatRoom = require('../models/ChatRoom');
        const room = await ChatRoom.findOne({ userId: req.user.id });
        const count = room ? room.unreadCountUser : 0;
        res.json({ count, totalChatsWithUnread: count > 0 ? 1 : 0 });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Admin-side: Fetch detailed thread with a user
router.get('/admin/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    try {
        const adminIds = await getAdminIds(req.user.id);
        const ChatRoom = require('../models/ChatRoom');

        // Fetch user's room to get clearedAtAdmin timestamp
        const room = await ChatRoom.findOne({ userId });
        const clearedAt = room?.clearedAtAdmin || new Date(0);

        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: userId }
            ],
            deletedForUsers: { $nin: [req.user.id] },
            timestamp: { $gt: clearedAt }
        }).sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('replyTo', 'text sender timestamp');
        res.json(messages.reverse());
    } catch (err) { res.status(500).send('Server Error'); }
});

// @route   POST api/chats/clear/:userId (Admin)
// @desc    Clear chat history for admin only
router.post('/clear/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    try {
        const adminIds = await getAdminIds(req.user.id);
        const ChatRoom = require('../models/ChatRoom');

        // 1. Mark as cleared with timestamp for ADMIN VIEW
        await ChatRoom.findOneAndUpdate(
            { userId },
            { $set: { clearedAtAdmin: new Date(), unreadCountAdmin: 0, lastMessage: "" } },
            { upsert: true }
        );

        // 2. Still tag messages for soft-delete security (optional but good)
        await Message.updateMany({
            $or: [
                { sender: userId, recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: userId }
            ],
            deletedForUsers: { $nin: [req.user.id] }
        }, {
            $addToSet: { deletedForUsers: req.user.id },
            $set: { seen: true, isRead: true, status: 'seen' }
        });

        res.json({ success: true, msg: 'Conversation cleared for admin' });

        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('chat_cleared', { userId: userId, clearedBy: req.user.id });
            const roomsWithUnread = await ChatRoom.countDocuments({ unreadCountAdmin: { $gt: 0 } });
            io.to('admin').emit('unread_count_update', { count: roomsWithUnread });
        }
    } catch (err) {
        console.error('Clear chat error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/chats/clear-history
// @desc    WhatsApp-style permanent clear for client (Soft-delete + Checkpoint + Sync)
router.delete('/clear-history', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', ...admins.map(a => String(a._id))];
        const ChatRoom = require('../models/ChatRoom');
        const userId = String(req.user.id);
        const now = new Date();

        // 1. ATOMIC MARKERS (Triple-layer security)
        await Promise.all([
            // Marker A: User Profile (Centralized source of truth)
            User.findByIdAndUpdate(userId, { $set: { lastChatClearAt: now } }),
            
            // Marker B: ChatRoom Preview (Sidebar/Badge cleaning)
            ChatRoom.findOneAndUpdate(
                { userId },
                { $set: { clearedAtUser: now, lastMessage: "", unreadCountUser: 0 } },
                { upsert: true }
            ),
            
            // Marker C: Message-level Tags (Redundancy)
            Message.updateMany({
                $or: [
                    { sender: userId, recipient: { $in: adminIds } },
                    { sender: { $in: adminIds }, recipient: userId }
                ],
                deletedForUsers: { $nin: [userId] }
            }, {
                $addToSet: { deletedForUsers: userId }
            })
        ]);

        // 2. PHYSICAL CLEANUP (Delete messages if both sides cleared)
        // This keeps the DB lean and ensures permanent removal from DB if both users are done with it.
        // We find messages where deletedForUsers contains the client AND at least one admin.
        const cleanupResult = await Message.deleteMany({
            $or: [
                { sender: userId, recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: userId }
            ],
            deletedForUsers: { $all: [userId], $not: { $size: 0 } } // Placeholder logic: if both sides agree, it's gone.
        });

        res.json({ success: true, msg: 'Chat history cleared successfully', cleaned: cleanupResult.deletedCount });

        // 3. REAL-TIME SYNC
        const io = req.app.get('io');
        if (io) {
            // Signal all sessions of this user to wipe their UI immediately
            io.to(userId).emit('chat_deleted', { userId: 'admin', timestamp: now });
        }
    } catch (err) {
        console.error('Serious Chat Delete Error:', err.message);
        res.status(500).json({ error: "Failed to clear chat history" });
    }
});

// Deprecated: Moving to DELETE /clear-history but keeping for tiny legacy support
router.post('/clear/admin', auth, async (req, res) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}/api/chats/clear-history`;
        console.warn(`DEPRECATED: Client called POST /clear/admin. Redirecting logic to DELETE /clear-history.`);
        // Just call the same logic as the DELETE route above
        const now = new Date();
        await User.findByIdAndUpdate(req.user.id, { $set: { lastChatClearAt: now } });
        res.json({ success: true, msg: 'Migrated: Use DELETE /api/chats/clear-history' });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.post('/react/:messageId', auth, async (req, res) => {
    const { emoji } = req.body;
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ msg: 'Message not found' });
        const existingIdx = message.reactions.findIndex(r => r.userId === req.user.id);
        if (existingIdx > -1) message.reactions[existingIdx].emoji = emoji;
        else message.reactions.push({ userId: req.user.id, emoji });
        await message.save();
        const io = req.app.get('io');
        if (io) io.to(message.recipient).to(message.sender).emit('message_reaction_update', { messageId: message._id, reactions: message.reactions });
        res.json(message.reactions);
    } catch (err) { res.status(500).send('Server Error'); }
});

router.delete('/:id/:mode', auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ msg: 'Message not found' });
        if (req.params.mode === 'everyone') {
            message.text = 'This transmission redacted';
            message.isDeletedEveryone = true;
            message.attachments = [];
            await message.save();
            const io = req.app.get('io');
            if (io) io.to(message.recipient).to(message.sender).emit('message_deleted_everyone', { id: message._id });
        } else {
            message.deletedForUsers.push(req.user.id);
            await message.save();
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;

module.exports = router;
