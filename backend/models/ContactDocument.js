const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioContact",
      required: true,
    },
    studioProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioProject",
      default: null,
    },
    type: {
      type: String,
      enum: ["Contract", "Questionnaire", "Message"],
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    status: { type: String, enum: ["Draft", "Archived"], default: "Draft" },
  },
  { timestamps: true },
);
schema.index({ contactId: 1, studioProjectId: 1 });
module.exports =
  mongoose.models.ContactDocument || mongoose.model("ContactDocument", schema);
