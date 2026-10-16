const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    clientName: { type: String, required: true },
    email: { type: String, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    title: { type: String, required: true },
    validUntil: Date,
    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Declined", "Archived"],
      default: "Draft",
    },
    items: [{ description: String, quantity: Number, unitPricePaise: Number }],
    discountPaise: { type: Number, default: 0 },
    taxRateBps: { type: Number, default: 0 },
    subtotalPaise: Number,
    taxPaise: Number,
    totalPaise: Number,
    terms: String,
    revision: { type: Number, default: 1 },
    history: [
      { revision: Number, status: String, totalPaise: Number, changedAt: Date },
    ],
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.Quotation || mongoose.model("Quotation", schema);
