const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  createdTime: { type: Date, default: Date.now },
  thumbnail: { type: String },
  clientId: { type: String, required: true }, // logical grouping, e.g. client name
  tags: [{ type: String }],
  isFavorite: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Media || mongoose.model('Media', mediaSchema);
