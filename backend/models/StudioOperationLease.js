const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, revision: Number, until: { type: Date, required: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } } });
module.exports = mongoose.models.StudioOperationLease || mongoose.model('StudioOperationLease', schema);
