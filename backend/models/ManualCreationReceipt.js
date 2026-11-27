const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  dataVersion: { type: Number, required: true },
  fingerprint: { type: String, required: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { versionKey: false, autoCreate: false });

module.exports = mongoose.models.ManualCreationReceipt || mongoose.model('ManualCreationReceipt', schema);
