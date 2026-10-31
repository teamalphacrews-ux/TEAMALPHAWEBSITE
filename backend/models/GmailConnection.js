const mongoose = require('mongoose');

// Mail remains in Google. This record contains only the owner's connection.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true },
  tokenEnvelope: { type: String, required: true, select: false },
  connectedAt: { type: Date, required: true },
  lastError: String,
  lastErrorCode: String,
}, { timestamps: true });

module.exports = mongoose.models.GmailConnection || mongoose.model('GmailConnection', schema);
