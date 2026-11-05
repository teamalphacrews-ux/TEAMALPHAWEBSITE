const mongoose = require('mongoose');
// Normalized provider events only. Tokens, signatures and full payloads are never saved.
const schema = new mongoose.Schema({
  _id: String,
  phoneNumberId: { type: String, required: true },
  providerId: { type: String, required: true },
  eventType: { type: String, enum: ['inbound', 'echo', 'status'], required: true },
  waId: String,
  name: String,
  kind: String,
  text: String,
  status: String,
  eventAt: Date,
  opensWindow: Boolean,
  done: { type: Boolean, default: false },
  processingUntil: Date,
}, { timestamps: true });
schema.index({ phoneNumberId: 1, providerId: 1, eventType: 1 });
module.exports = mongoose.models.WhatsAppReceipt || mongoose.model('WhatsAppReceipt', schema);
