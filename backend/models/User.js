const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'client' },
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
    googleResourceId: String
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
