const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    location: String,
    teamMembers: [String],
    type: { type: String, enum: ['Wedding', 'Pre-Wedding', 'Engagement', 'Meeting', 'Birthday', 'Other'], default: 'Wedding' },
    photos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Gallery' }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    googleEventId: { type: String, unique: true, sparse: true },
    googleEventType: { type: String, default: 'default' },
    isReadOnly: { type: Boolean, default: false },
    lastUpdatedFrom: { type: String, enum: ['local', 'google'], default: 'local' },
    origin: { type: String, enum: ['local', 'google'], default: 'local' },
    description: String
}, { timestamps: true });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
