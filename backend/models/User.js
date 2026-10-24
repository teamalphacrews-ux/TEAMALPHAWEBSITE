const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'client' },
    studioOwner: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0, select: false },
    studioPreferences: {
      type: new mongoose.Schema({ layoutVersion: { type: Number, default: 1, min: 1, max: 2 }, theme: { type: String, enum: ['light', 'dark'], default: 'light' }, visibleCards: { type: [String], default: () => [...require('../utils/studioPreferences').CARD_IDS] } }, { _id: false }),
      default: () => require('../utils/studioPreferences').defaults(),
    },
    galleryTag: { type: String },
    cloudLink: { type: String },
    cloudPassword: { type: String },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    clearedChats: [{
        contactId: String, // userId or 'admin'
        clearedAt: { type: Date, default: Date.now }
    }],
    googleAccessToken: String,
    googleRefreshToken: String,
    googleTokenExpiry: Date,
    googleCalendarId: { type: String, default: 'primary' },
    googleEmail: String,
    googleWebhookId: String,
    googleResourceId: String,
    googleLastSyncAt: Date,
    googleSyncError: String,
    vaultPassword: { type: String }, // Reversible encrypted password for the vault
    iv: { type: String }, // Initialization vector for AES decryption
    lastChatClearAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
