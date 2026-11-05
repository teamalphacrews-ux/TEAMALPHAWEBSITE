const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  data: { type: Buffer, required: true, select: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
module.exports = mongoose.models.StudioProfileImage || mongoose.model('StudioProfileImage', schema);
