const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    dueDate: Date,
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    clientVisible: { type: Boolean, default: false },
    clientTitle: { type: String, default: '' },
    deliveryType: { type: String, enum: ['Photos', 'Album', 'Traditional video', 'Cinematic video', 'Other'], default: 'Other' },
    productionStage: { type: String, enum: ['Not started', 'In progress', 'Editing', 'In review', 'Awaiting your selection', 'Ready', 'Uploaded to Drive', 'Delivered'], default: 'Not started' },
    clientUpdate: { type: String, default: '' },
    deliveryUrl: { type: String, default: '' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Photographer', default: null }
}, { timestamps: true });

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
