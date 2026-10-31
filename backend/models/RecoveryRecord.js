const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  model: { type: String, required: true }, recordId: { type: String, required: true },
  label: { type: String, maxlength: 200 }, deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  encrypted: { type: String, required: true, select: false }, restoredAt: Date,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
module.exports = mongoose.models.RecoveryRecord || mongoose.model('RecoveryRecord', schema);
