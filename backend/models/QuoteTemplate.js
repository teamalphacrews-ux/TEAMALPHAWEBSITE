const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    title: String,
    items: [{ description: String, quantity: Number, unitPricePaise: Number }],
    discountPaise: Number,
    taxRateBps: Number,
    terms: String,
    validityDays: { type: Number, default: 14, min: 1, max: 365 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.QuoteTemplate || mongoose.model("QuoteTemplate", schema);
