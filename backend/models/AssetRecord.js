const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    mediaType: {
      type: String,
      enum: ["Photos", "Video", "Audio", "Project files", "Other"],
      default: "Photos",
    },
    storageLocation: { type: String, required: true },
    sizeGb: { type: Number, min: 0, default: 0 },
    backupLocation: String,
    backupStatus: {
      type: String,
      enum: ["Pending", "Verified", "Needs attention"],
      default: "Pending",
    },
    checksum: String,
    notes: String,
    verifiedAt: Date,
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.AssetRecord || mongoose.model("AssetRecord", schema);
