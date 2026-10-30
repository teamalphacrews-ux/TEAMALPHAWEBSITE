const mongoose = require('mongoose');
const preferences = require('../utils/studioPreferences');
const personalDefaults = preferences.personalDefaults();
const personalPreferenceFields = {
  ...Object.fromEntries(Object.entries(preferences.PERSONAL_ENUMS).map(([key, choices]) => [key, { type: String, enum: choices, default: personalDefaults[key] }])),
  ...Object.fromEntries(preferences.PERSONAL_BOOLEANS.map(key => [key, { type: Boolean, default: personalDefaults[key] }])),
  timezone: { type: String, default: 'studio', maxlength: 80, validate: preferences.validTimezone },
  notificationVolume: { type: Number, default: 50, min: 0, max: 100, validate: Number.isInteger },
  notificationCategories: { type: [String], enum: preferences.NOTIFICATION_CATEGORIES, default: () => [...preferences.NOTIFICATION_CATEGORIES], validate: value => new Set(value).size === value.length },
  quietHoursStart: { type: String, default: '22:00', validate: preferences.validClockTime },
  quietHoursEnd: { type: String, default: '08:00', validate: preferences.validClockTime },
};

const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'client' },
    studioOwner: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0, select: false },
    studioPreferences: {
      type: new mongoose.Schema({ layoutVersion: { type: Number, default: 1, min: 1, max: 3 }, theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' }, reduceMotion: { type: Boolean, default: false }, landingPage: { type: String, enum: preferences.LANDING_PAGES, default: '/admin' }, visibleCards: { type: [String], default: () => [...preferences.CARD_IDS] }, cardOrder: { type: [String], default: () => [...preferences.DEFAULT_CARD_ORDER] }, ...personalPreferenceFields }, { _id: false }),
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
