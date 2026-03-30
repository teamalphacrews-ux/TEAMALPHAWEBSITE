const mongoose = require('mongoose');

const SheetConfigSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['status', 'event', 'photos', 'team'],
    unique: true
  },
  options: [{
    type: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('SheetConfig', SheetConfigSchema);
