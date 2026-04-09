const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
    masterPasswordHash: { type: String, required: true },
    isInitialized: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);
