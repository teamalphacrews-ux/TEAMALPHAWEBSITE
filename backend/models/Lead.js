const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    status: {
        type: String,
        enum: ['New', 'Follow-up', 'Meeting', 'Negotiation', 'Converted', 'Archived'],
        default: 'New'
    },
    remarks: String,
    eventType: String,
    eventDate: Date,
    eventTime: String, // e.g. "10:00 AM"
    eventLocation: String, // e.g. "Taj Hotel, Mumbai"
    followUpDate: Date,
    notes: String,
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    people: [String], // Access for group
    paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Deposit Paid', 'Paid'],
        default: 'Unpaid'
    },
    totalAmount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    galleryTag: { type: String },
    cloudLink: { type: String },
    cloudPassword: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
