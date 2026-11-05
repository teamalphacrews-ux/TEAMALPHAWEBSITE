const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
    },
    revision: { type: Number, required: true },
    key: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ["email", "reminder", "confirmation"],
      default: "email",
    },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed", "unknown", "cancelled"],
      default: "queued",
    },
    dueAt: { type: Date, required: true },
    startedAt: Date,
    sentAt: Date,
    subject: String,
    message: String,
    sendCopy: { type: Boolean, default: false },
    recipient: String,
    messageId: String,
    error: String,
  },
  { timestamps: true },
);
schema.index({ status: 1, dueAt: 1 });
module.exports =
  mongoose.models.QuoteDelivery || mongoose.model("QuoteDelivery", schema);
