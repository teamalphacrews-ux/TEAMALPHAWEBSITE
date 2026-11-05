const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  phoneNumberId: { type: String, required: true },
  waId: { type: String, required: true },
  name: { type: String, default: '' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudioContact' },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  lastMessage: { type: String, default: '' },
  lastMessageAt: Date,
  lastInboundAt: Date,
  lastInboundReceivedAt: Date,
  lastReadAt: Date,
  lastSendAttemptAt: Date,
  optInConfirmed: { type: Boolean, default: false },
  optInSource: { type: String, default: '' },
  optInAt: Date,
  optInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ phoneNumberId: 1, waId: 1 }, { unique: true });
schema.index({ phoneNumberId: 1, lastMessageAt: -1, _id: -1 });
schema.index({ phoneNumberId: 1, lastInboundReceivedAt: -1 });
module.exports = mongoose.models.WhatsAppConversation || mongoose.model('WhatsAppConversation', schema);
