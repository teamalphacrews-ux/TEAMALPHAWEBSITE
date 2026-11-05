const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    contactType: {
      type: String,
      enum: ["Client", "Lead", "Other"],
      default: "Client",
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: "", trim: true },
    company: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
    note: { type: String, default: "" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ email: 1 });
module.exports =
  mongoose.models.StudioContact || mongoose.model("StudioContact", schema);
