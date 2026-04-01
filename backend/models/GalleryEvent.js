const mongoose = require('mongoose');

const galleryEventSchema = new mongoose.Schema({
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DriveGallery', 
    required: true 
  },
  name: { type: String, required: true },
  thumbnail: { type: String, required: false },
  driveFolderId: { type: String, required: true },
  eventDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.GalleryEvent || mongoose.model('GalleryEvent', galleryEventSchema);
