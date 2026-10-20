const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
      index: true,
    },
    author: { type: String, enum: ["client", "studio"], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    requestId: { type: String, required: true },
    studioRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ quotation: 1, author: 1, requestId: 1 }, { unique: true });
schema.index({ quotation: 1, createdAt: -1, _id: -1 });
module.exports =
  mongoose.models.ProjectMessage || mongoose.model("ProjectMessage", schema);
