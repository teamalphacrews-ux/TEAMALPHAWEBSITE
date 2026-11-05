const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true },
  tokenEnvelope: { type: String, required: true, select: false },
  connectedAt: { type: Date, required: true },
}, { timestamps: true });
module.exports = mongoose.models.DriveBackupConnection || mongoose.model('DriveBackupConnection', schema);
