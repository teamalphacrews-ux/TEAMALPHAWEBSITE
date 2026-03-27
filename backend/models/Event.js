const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    location: String,
    teamMembers: [String],
    type: { type: String, enum: ['Wedding', 'Pre-Wedding', 'Engagement', 'Meeting'], default: 'Wedding' }
}, { timestamps: true });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
