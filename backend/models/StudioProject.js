const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioContact",
      required: true,
    },
    name: { type: String, required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    type: { type: String, default: "Wedding" },
    status: {
      type: String,
      enum: ["Inquiry", "Booked", "Completed", "Archived"],
      default: "Inquiry",
    },
    startDate: Date,
    endDate: Date,
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    additionalClients: [
      { type: mongoose.Schema.Types.ObjectId, ref: "StudioContact" },
    ],
    notes: [
      {
        body: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);
schema.index({ contactId: 1 });
module.exports =
  mongoose.models.StudioProject || mongoose.model("StudioProject", schema);
