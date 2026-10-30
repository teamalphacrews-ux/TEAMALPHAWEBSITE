const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  kind: { type: String, enum: ['manual', 'scheduled'], required: true },
  slot: { type: String, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  encrypted: { type: String, required: true, select: false },
  counts: { type: Map, of: Number }, bytes: Number,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  restoredAt: Date,
}, { timestamps: true });
module.exports = mongoose.models.StudioBackup || mongoose.model('StudioBackup', schema);
