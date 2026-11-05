const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, value: { type: Number, required: true, min: 1 } }, { versionKey: false });
module.exports = mongoose.models.DocumentCounter || mongoose.model('DocumentCounter', schema);
