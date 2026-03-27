const mongoose = require('mongoose');

const photographerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    specialty: {
        type: String,
        enum: [
            'LEAD PHOTOGRAPHER',
            'LEAD CANDID PHOTOGRAPHER',
            'LEAD CINEMATOGRAPHER',
            'CONVENTIONAL PHOTOGRAPHER',
            'CONVENTIONAL VIDEOGRAPHER',
            'SPOT EDITOR',
            'EDITOR',
            'DRONE OPERATOR',
            'ASSISTANT',
            'LIVE STREAMER',
            'LED WALL OPERATOR'
        ],
        default: 'LEAD PHOTOGRAPHER'
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    profileImage: String,
}, { timestamps: true });

module.exports = mongoose.models.Photographer || mongoose.model('Photographer', photographerSchema);
