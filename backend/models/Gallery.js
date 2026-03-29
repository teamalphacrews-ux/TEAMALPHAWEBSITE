const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
    albumName: { type: String, required: true },
    clientFolder: { type: String, required: true, default: "Default Client" },
    url: { type: String, required: true },
    link: { type: String }, // Used specifically for Drive links
    type: { type: String, enum: ['image', 'video', 'drive'], default: 'image' },
    category: { type: String, enum: ['Engagement', 'Wedding', 'Pre-wedding', 'Haldi', 'Reception', 'Sangeeth', 'Other'], default: 'Wedding' },
    driveName: { type: String }, // Optional: Group photos under a named drive
    subCategory: { type: String }, // e.g., 'Candid', 'Traditional', 'Drone'
    tags: [{ type: String }],
    width: { type: Number },
    height: { type: Number },
    size: { type: Number }, // Size in bytes
    isFavorite: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
    isCover: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Gallery || mongoose.model('Gallery', gallerySchema);

