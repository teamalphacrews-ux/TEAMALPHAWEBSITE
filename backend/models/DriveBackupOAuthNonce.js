const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, kind: { type: String, enum: ['handoff', 'state'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, browserHash: String, codeVerifier: String,
  expiresAt: { type: Date, required: true } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.DriveBackupOAuthNonce || mongoose.model('DriveBackupOAuthNonce', schema);
