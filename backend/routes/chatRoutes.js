const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

// @route   POST api/chats
// @desc    Send a message
router.post('/', auth, async (req, res) => {
    const { text, recipient, messageType, attachments, replyTo } = req.body;
    try {
        const user = await User.findById(req.user.id);
        const senderName = user ? (user.name || `${user.firstName} ${user.lastName}`.trim()) : 'Alpha Admin';

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
            status: 'sent'
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await Message.findById(savedMessage._id)
            .populate('replyTo', 'text sender timestamp');

        const io = req.app.get('io');
        if (io) {
            // 1. Sending to the recipient
            io.to(recipient).emit('new_message', populatedMessage);
            
            // 2. Sending to the sender (for multi-tab sync)
            io.to(req.user.id).emit('new_message', populatedMessage);
            
            // 3. Ensuring admins get a copy if they are watching the general portal
            io.to('admin').emit('new_message', populatedMessage);
        }

        res.json(populatedMessage);
    } catch (err) {
        console.error('Chat POST Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/chats
// @desc    Client-side: Fetch messages between this user and admins
router.get('/', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', ...admins.map(a => String(a._id))];
        
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: req.user.id }
            ],
            deletedForUsers: { $ne: req.user.id }
        }).sort({ timestamp: 1 })
          .populate('replyTo', 'text sender timestamp');

        res.json(messages);
    } catch (err) {
        console.error('Chat GET Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// @route   GET api/chats/admin/conversations
// @desc    Admin-side: List all unique client conversations with summary and unread counts
router.get('/admin/conversations', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
        
        const messages = await Message.find({
            $or: [
                { sender: { $in: adminIds } },
                { recipient: { $in: adminIds } }
            ]
        }).sort({ timestamp: -1 });

        const conversationsMap = {};
        const participantIds = new Set();

        messages.forEach(msg => {
            const senderStr = String(msg.sender);
            const recipientStr = String(msg.recipient);
            const otherParty = adminIds.includes(senderStr) ? recipientStr : senderStr;
            
            if (adminIds.includes(otherParty)) return;
            participantIds.add(otherParty);

            if (!conversationsMap[otherParty]) {
                conversationsMap[otherParty] = {
                    userId: otherParty,
                    lastMessage: msg.text,
                    timestamp: msg.timestamp,
                    unreadCount: 0
                };
            }

            // Unread: Sent TO an admin ID and NOT seen
            if (!msg.seen && adminIds.includes(recipientStr)) {
                conversationsMap[otherParty].unreadCount += 1;
            }
        });

        const users = await User.find({ _id: { $in: Array.from(participantIds) } }, 'firstName lastName name');
        const userDetails = {};
        users.forEach(u => userDetails[u._id.toString()] = u.name || `${u.firstName} ${u.lastName}`.trim());

        const result = Object.values(conversationsMap).map(conv => ({
            ...conv,
            userName: userDetails[conv.userId] || 'Alpha Client'
        }));

        res.json(result);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// @route   GET api/chats/unread-summary
router.get('/unread-summary', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
        const unreadMessages = await Message.find({ recipient: { $in: adminIds }, seen: false });
        const uniqueChatSenders = new Set(unreadMessages.map(m => String(m.sender)));
        res.json({ totalChatsWithUnread: uniqueChatSenders.size });
    } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT api/chats/mark-as-seen
router.put('/mark-as-seen', auth, async (req, res) => {
    const { chatId } = req.body;
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
        
        await Message.updateMany(
            { sender: chatId, recipient: { $in: adminIds }, seen: false }, 
            { $set: { seen: true, isRead: true, status: 'seen' } }
        );
        
        const unreadMessages = await Message.find({ recipient: { $in: adminIds }, seen: false });
        const totalUnreadChats = new Set(unreadMessages.map(m => String(m.sender))).size;

        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('chat_seen', { chatId, totalUnreadChats });
            io.to('admin').emit('unread_count_update', { count: totalUnreadChats });
        }
        res.json({ success: true, totalUnreadChats });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Backwards compatibility for client-side legacy routes
router.put('/read', auth, async (req, res) => {
    const { chatId } = req.body;
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
        await Message.updateMany({ sender: chatId, recipient: { $in: adminIds }, seen: false }, { $set: { seen: true, isRead: true, status: 'seen' } });
        res.json({ success: true });
    } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/unread', auth, async (req, res) => {
    try {
        const admins = await User.find({ role: 'admin' }, '_id');
        const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
        const unreadMessages = await Message.find({ recipient: { $in: adminIds }, seen: false });
        const uniqueChatSenders = new Set(unreadMessages.map(m => String(m.sender)));
        res.json({ count: uniqueChatSenders.size });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Admin-side: Fetch detailed thread with a user
router.get('/admin/:userId', auth, async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const admins = await User.find({ role: 'admin' }, '_id');
    const adminIds = ['admin', 'hardcoded-admin-id', req.user.id, ...admins.map(a => String(a._id))];
    try {
        const messages = await Message.find({
            $or: [
                { sender: userId, recipient: { $in: adminIds } },
                { sender: { $in: adminIds }, recipient: userId }
            ]
        }).sort({ timestamp: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('replyTo', 'text sender timestamp');
        res.json(messages.reverse());
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
