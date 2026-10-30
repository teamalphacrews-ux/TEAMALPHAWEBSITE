const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
  showCrew: Boolean, showProgress: Boolean, showDeliverables: Boolean,
  showPayments: Boolean, allowChat: Boolean, linkExpiryDays: { type: Number, min: 0, max: 3650 },
}, { _id: false });
