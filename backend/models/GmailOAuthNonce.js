const mongoose = require('mongoose');

// Separate collection from Calendar: neither integration can consume the other's state.
const schema = new mongoose.Schema({
  _id: String,
  kind: { type: String, enum: ['handoff', 'state'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  browserHash: String,
  codeVerifier: String,
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.GmailOAuthNonce || mongoose.model('GmailOAuthNonce', schema);
