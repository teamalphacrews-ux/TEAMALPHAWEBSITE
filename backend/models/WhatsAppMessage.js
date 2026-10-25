const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  phoneNumberId: { type: String, required: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppConversation', required: true },
  waId: { type: String, required: true },
  providerId: String,
  requestId: String,
  payloadHash: { type: String, select: false },
  canonicalMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppMessage' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  kind: { type: String, enum: ['text', 'template', 'unsupported'], required: true },
  text: { type: String, required: true },
  status: { type: String, enum: ['received', 'sending', 'submitted', 'sent', 'delivered', 'read', 'failed', 'unknown'], required: true },
  statusAt: Date,
  receivedAt: Date,
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  error: String,
}, { timestamps: true });
schema.index({ phoneNumberId: 1, providerId: 1 }, { unique: true, partialFilterExpression: { providerId: { $type: 'string' } } });
schema.index({ phoneNumberId: 1, requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } });
schema.index({ conversation: 1, createdAt: -1, _id: -1 });
module.exports = mongoose.models.WhatsAppMessage || mongoose.model('WhatsAppMessage', schema);
