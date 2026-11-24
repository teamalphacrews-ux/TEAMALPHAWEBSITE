const mongoose = require('mongoose');
const numberingScope = new mongoose.Schema({
  stem: { type: String, required: true },
  mode: { type: String, enum: ['sequence', 'reference'], required: true },
}, { _id: false });
const schema = new mongoose.Schema({
  _id: String,
  value: { type: Number, required() { return !this.invoiceNumbering; }, min: 1 },
  invoiceNumbering: { type: numberingScope, default: undefined },
  pendingInvoices: { type: Map, of: Number, default: undefined },
}, { versionKey: false, toObject: { flattenMaps: true } });
module.exports = mongoose.models.DocumentCounter || mongoose.model('DocumentCounter', schema);
