const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'alpha-chat-attachments',
        resource_type: 'auto'
    },
});

const upload = multer({ storage });

// @route   POST api/chats
// @desc    Send a message
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { text, recipient, replyTo } = req.body;
        const user = await User.findById(req.user.id);
        const isAdmin = req.user.role === 'admin' || req.user.id === 'hardcoded-admin-id';

        const newMessage = new Message({
            sender: req.user.id,
            senderName: user ? user.firstName : (isAdmin ? 'System Admin' : 'Unknown'),
            recipient: recipient || 'admin',
            text,
            replyTo: replyTo || null
        });

        const message = await newMessage.save();

        // Emit Socket Event
        const io = req.app.get('io');
        const roomId = recipient === 'admin' ? 'admin' : (recipient || 'admin');
        io.to(roomId).emit('receive_message', message);
        io.to(req.user.id).emit('receive_message', message); // Also send to sender for multi-device sync

        res.json(message);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/chats
// @desc    Get user's chat history
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        // Find messages where user is either sender or recipient
        const messages = await Message.find({
            $or: [
                { sender: req.user.id },
                { recipient: req.user.id }
            ]
        }).sort({ timestamp: 1 });

        res.json(messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/chats/admin/conversations
// @desc    Get all conversations for admin
// @access  Private (Admin only)
router.get('/admin/conversations', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied' });
    }

    try {
        // Group messages by client (who is either sender or recipient)
        const currentUserId = req.user.id;
        const messages = await Message.find({
            $or: [
                { sender: currentUserId },
                { recipient: 'admin' },
                { recipient: currentUserId }
            ]
        }).sort({ timestamp: -1 });

        // Simple grouping in JavaScript (can be optimized with aggregation)
        const conversations = {};
        messages.forEach(msg => {
            const clientUserId = msg.recipient === 'admin' ? msg.sender : msg.recipient;
            if (!conversations[clientUserId]) {
                conversations[clientUserId] = {
                    userId: clientUserId,
                    userName: msg.recipient === 'admin' ? msg.senderName : 'Client',
                    lastMessage: msg.text,
                    timestamp: msg.timestamp,
                    unreadCount: 0
                };
            }
            if (!msg.isRead && msg.recipient === 'admin') {
                conversations[clientUserId].unreadCount += 1;
            }
        });

        res.json(Object.values(conversations));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/chats/admin/:userId
// @desc    Get specific conversation for admin
// @access  Private (Admin only)
router.get('/admin/:userId', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied' });
    }

    try {
        const { page = 1, limit = 40 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Check for clearedAt timestamp for this conversation
        const user = await User.findById(req.user.id);
        const chatClearInfo = user.clearedChats?.find(c => c.contactId === req.params.userId);
        const clearedAt = chatClearInfo ? chatClearInfo.clearedAt : new Date(0);

        const query = {
            $or: [
                { sender: req.params.userId, recipient: 'admin' },
                { sender: req.user.id, recipient: req.params.userId }
            ],
            timestamp: { $gt: clearedAt },
            deletedForUsers: { $ne: req.user.id } // Hide if deleted "for me"
        };

        const messages = await Message.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('replyTo');

        res.json(messages.reverse());
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/chats/read
// @desc    Mark conversation as read
// @access  Private
router.put('/read', auth, async (req, res) => {
    try {
        const { senderId } = req.body;
        const filter = {
            recipient: req.user.role === 'admin' ? 'admin' : req.user.id,
            sender: senderId,
            isRead: false
        };

        await Message.updateMany(filter, { $set: { isRead: true } });
        res.json({ msg: 'Messages marked as read' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/chats/unread
// @desc    Get total unread messages count
// @access  Private
router.get('/unread', auth, async (req, res) => {
    try {
        const recipientId = req.user.role === 'admin' ? 'admin' : req.user.id;
        const count = await Message.countDocuments({
            recipient: recipientId,
            isRead: false
        });
        res.json({ count });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PATCH api/chats/:id
// @desc    Edit a message
// @access  Private
router.patch('/:id', auth, async (req, res) => {
    try {
        const { text } = req.body;
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ msg: 'Message not found' });
        if (message.sender.toString() !== req.user.id) return res.status(401).json({ msg: 'Unauthorized' });

        message.text = text;
        message.isEdited = true;
        await message.save();

        const io = req.app.get('io');
        const roomId = message.recipient === 'admin' ? 'admin' : message.recipient;
        io.to(roomId).emit('message_edited', message);

        res.json(message);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/chats/:messageId/:mode
// @desc    Delete message (me or everyone)
// @access  Private
router.delete('/:messageId/:mode', auth, async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ msg: 'Message not found' });

        if (req.params.mode === 'everyone') {
            // Only sender can delete for everyone
            if (message.sender.toString() !== req.user.id) {
                return res.status(403).json({ msg: 'Not authorized to delete for everyone' });
            }
            message.isDeletedEveryone = true;
            message.text = 'This message was deleted';
            message.attachments = [];
        } else {
            // Delete for me
            if (!message.deletedForUsers.includes(req.user.id)) {
                message.deletedForUsers.push(req.user.id);
            }
        }

        await message.save();

        // Broadcast deletion via socket
        const io = req.app.get('io'); // Use 'io' as set in server.js
        if (io) {
            const roomId = message.recipient === 'admin' ? message.sender.toString() : message.recipient;
            if (req.params.mode === 'everyone') {
                io.to(roomId).emit('message_deleted_everyone', { id: message._id });
            }
        }

        res.json(message);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/chats/clear/:userId
// @desc    Clear chat history for a specific user
// @access  Private
router.post('/clear/:userId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const contactId = req.params.userId;

        const existingIdx = user.clearedChats.findIndex(c => c.contactId === contactId);
        if (existingIdx > -1) {
            user.clearedChats[existingIdx].clearedAt = new Date();
        } else {
            user.clearedChats.push({ contactId, clearedAt: new Date() });
        }

        await user.save();
        res.json({ msg: 'Chat cleared successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PATCH api/chats/seen/:userId
// @desc    Mark messages as seen
// @access  Private
router.patch('/seen/:userId', auth, async (req, res) => {
    try {
        const recipientId = req.user.role === 'admin' ? 'admin' : req.user.id;
        const filter = {
            sender: req.params.userId,
            recipient: recipientId,
            status: { $ne: 'seen' }
        };

        await Message.updateMany(filter, { $set: { status: 'seen', isRead: true } });

        const io = req.app.get('io');
        io.to(req.params.userId).emit('messages_seen', { seenBy: req.user.id });

        res.json({ msg: 'Messages marked as seen' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/chats/upload
// @desc    Upload an attachment
// @access  Private
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
        res.json({
            url: req.file.path,
            fileType: req.file.mimetype,
            fileName: req.file.originalname
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/chats/react/:id
// @desc    Toggle reaction on a message
// @access  Private
router.post('/react/:id', auth, async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ msg: 'Message not found' });

        const existingIdx = message.reactions.findIndex(r => r.userId === req.user.id && r.emoji === emoji);
        if (existingIdx > -1) {
            message.reactions.splice(existingIdx, 1);
        } else {
            // Optional: Remove other reactions from this user first if you only want one per user
            message.reactions = message.reactions.filter(r => r.userId !== req.user.id);
            message.reactions.push({ emoji, userId: req.user.id });
        }

        await message.save();

        const io = req.app.get('io');
        const roomId = message.recipient === 'admin' ? 'admin' : message.recipient;
        io.to(roomId).emit('message_reaction_update', { messageId: message._id, reactions: message.reactions });

        res.json(message.reactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
