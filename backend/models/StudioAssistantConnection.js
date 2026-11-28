const mongoose = require('mongoose');

// The tenant model router keeps these records in each studio's own database.
// The provider key is the unique MongoDB document ID within that database.
const schema = new mongoose.Schema({
  _id: { type: String, enum: ['openai', 'claude'], required: true },
  model: { type: String, required: true, maxlength: 120 },
  keyEnvelope: { type: String, required: true, select: false },
}, { timestamps: true });

module.exports = mongoose.models.StudioAssistantConnection || mongoose.model('StudioAssistantConnection', schema);
