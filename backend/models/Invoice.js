const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    clientName: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    events: [{
        eventName: String,
        services: String,
        equipment: String,
        dateLocation: String,
        price: Number
    }],
    deliverables: { type: [String], default: ['All RAW Data', '35 Pre wedding Edited Photos', 'Pre wedding cinematic Video (3 min max)', 'Wedding edited images', '2 Premium Wedding Albums 15*24(40 pages)', 'Wedding Cinematography Video 5 Min', 'Traditional Video Edited 2 Hrs max', 'Reels'] },
    deliverablesPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    extraCharges: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    timeline: [{
        deliverable: String,
        time: String
    }],
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['Paid', 'Pending', 'Cancelled'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
