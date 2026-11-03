const mongoose = require('mongoose');
const reader = new mongoose.Schema({
  id: { type: String, required: true },
  dataVersion: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  _id: { type: String, default: 'legacy' },
  dataVersion: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  integrationsPaused: { type: Boolean, default: false },
  uncertainReaders: { type: Boolean, default: false },
  maintenanceToken: String,
  maintenanceUntil: Date,
  readers: { type: [reader], default: () => [] },
}, { versionKey: false });
// This singleton belongs to the personal installation, never a tenant database.
// No timestamps: no-op admission checks must not change a transaction snapshot.
module.exports = mongoose.connection.models.StudioArchiveState ||
  mongoose.connection.model('StudioArchiveState', schema);
