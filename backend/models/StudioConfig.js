const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "studio" },
    studioName: { type: String, default: "Team Alpha" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    invoicePrefix: { type: String, default: "TA" },
    quotationValidityDays: { type: Number, default: 14 },
    quotationTerms: { type: String, default: "" },
    paymentInstructions: { type: String, default: "" },
    defaultDeliverables: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.StudioConfig || mongoose.model("StudioConfig", schema);
