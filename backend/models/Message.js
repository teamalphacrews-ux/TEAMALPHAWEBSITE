const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {
        type: String, // userId or 'admin'
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    recipient: {
        type: String, // 'admin' or userId
        required: true
    },
    text: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent'
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeletedEveryone: {
        type: Boolean,
        default: false
    },
    deletedForUsers: [{
        type: String // List of user IDs who deleted this for themselves
    }],
    attachments: [{
        url: String,
        fileType: String,
        fileName: String
    }],
    messageType: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    },
    seen: {
        type: Boolean,
        default: false
    },
    reactions: [{
        emoji: String,
        userId: String
    }]
});

module.exports = mongoose.model('Message', MessageSchema);
