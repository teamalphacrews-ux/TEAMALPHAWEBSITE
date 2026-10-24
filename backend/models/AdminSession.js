const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, default: 0 },
  userAgent: { type: String, maxlength: 300 },
  createdAt: { type: Date, required: true }, lastSeenAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, revokedAt: Date,
});
module.exports = mongoose.models.AdminSession || mongoose.model('AdminSession', schema);
