const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true },
    category: String,
    studioProjectId: { type: mongoose.Schema.Types.ObjectId, ref:'StudioProject', default:null },
    receipt: { mimeType:String, bytes:Number, updatedAt:Date },
    description: String,
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending', 'Received', 'Paid'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.models.Finance || mongoose.model('Finance', financeSchema);
