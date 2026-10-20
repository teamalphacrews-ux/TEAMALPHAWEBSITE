const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    title: String,
    items: [
      {
        title: String,
        description: String,
        quantity: Number,
        unitPricePaise: Number,
      },
    ],
    discountType: {
      type: String,
      enum: ["amount", "percent"],
      default: "amount",
    },
    discountValue: Number,
    discountPaise: Number,
    taxRateBps: Number,
    terms: String,
    notes: String,
    design: { coverImage: String, colorTheme: String, fontTheme: String },
    autoCreateInvoice: { type: Boolean, default: true },
    expiryEnabled: { type: Boolean, default: true },
    remindersEnabled: { type: Boolean, default: false },
    reminderDays: { type: [Number], default: [3, 7, 14, 21, 30] },
    validityDays: { type: Number, default: 14, min: 1, max: 365 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.QuoteTemplate || mongoose.model("QuoteTemplate", schema);
