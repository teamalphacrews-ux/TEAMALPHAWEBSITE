const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  workspaceId: { type: String, required: true, immutable: true },
  requestId: { type: String, required: true, immutable: true },
  payloadHash: { type: String, required: true, select: false, immutable: true },
  fingerprint: { type: String, required: true, select: false, immutable: true },
  phone: { type: String, required: true, immutable: true },
  text: { type: String, required: true, maxlength: 4096, immutable: true },
  subscriberId: { type: String, required: true, select: false, immutable: true },
  permissionConfirmed: { type: Boolean, required: true, immutable: true },
  replyWindowConfirmed: { type: Boolean, required: true, immutable: true },
  status: { type: String, enum: ['sending', 'submitted', 'failed', 'unknown'], default: 'sending', required: true },
  error: { type: String, default: '', maxlength: 300 },
  attemptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', immutable: true },
}, { timestamps: true });

schema.index({ workspaceId: 1, requestId: 1 }, { unique: true });
schema.index({ workspaceId: 1, createdAt: -1 });
module.exports = mongoose.models.WabbMessageAttempt || mongoose.model('WabbMessageAttempt', schema);
