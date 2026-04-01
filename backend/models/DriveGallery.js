const mongoose = require('mongoose');

const driveGallerySchema = new mongoose.Schema({
  name: { type: String, required: true },
  thumbnail: { type: String, required: false }, // URL or Base64
  driveFolderId: { type: String, required: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.DriveGallery || mongoose.model('DriveGallery', driveGallerySchema);
