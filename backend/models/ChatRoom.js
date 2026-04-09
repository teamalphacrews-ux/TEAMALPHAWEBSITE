const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
    userId: {
        type: String, // The client's unique ID
        required: true,
        unique: true
    },
    unreadCountAdmin: {
        type: Number,
        default: 0
    },
    unreadCountUser: {
        type: Number,
        default: 0
    },
    lastMessage: {
        type: String
    },
    lastTimestamp: {
        type: Date,
        default: Date.now
    },
    clearedAtUser: {
        type: Date
    },
    clearedAtAdmin: {
        type: Date
    }
});

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
