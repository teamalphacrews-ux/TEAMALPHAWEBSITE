const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, default: 'studio', unique: true },
  phoneNumberId: String,
  businessAccountId: String,
  fingerprint: { type: String, select: false },
  state: { type: String, enum: ['verification_needed', 'coexistence_required', 'connected', 'api_verified', 'unavailable'], default: 'verification_needed' },
  coexistence: { type: Boolean, default: false },
  displayPhoneNumber: String,
  verifiedName: String,
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  error: String,
}, { timestamps: true });
module.exports = mongoose.models.WhatsAppConnection || mongoose.model('WhatsAppConnection', schema);
