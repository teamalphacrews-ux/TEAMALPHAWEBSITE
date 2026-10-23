const mongoose = require("mongoose");
const schema = new mongoose.Schema(
  {
    shareToken: { type: String, select: false },
    shareTokenHash: { type: String, select: false },
    sharedAt: Date,
    acceptedAt: Date,
    invoiceGeneratedAt: Date,
    acceptedBy: String,
    acceptedNotifiedAt: Date,
    emailConfirmationStatus: {
      type: String,
      enum: ["none", "queued", "sent", "failed", "unknown", "unavailable"],
      default: "none",
    },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    documentNumber: { type: String, maxlength: 40 },
    issueDate: Date,
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioContact",
      default: null,
    },
    studioProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioProject",
      default: null,
    },
    clientPhone: String,
    autoCreateInvoice: { type: Boolean, default: true },
    expiryEnabled: { type: Boolean, default: true },
    remindersEnabled: { type: Boolean, default: false },
    reminderDays: { type: [Number], default: [3, 7, 14, 21, 30] },
    design: {
      coverImage: String,
      colorTheme: { type: String, default: "#1f2427" },
      fontTheme: { type: String, default: "modern" },
    },
    notes: String,
    cancelledAt: Date,
    archivedAt: Date,
    expiredNotifiedAt: Date,
    timeline: [
      { kind: String, message: String, at: { type: Date, default: Date.now } },
    ],
    clientName: { type: String, required: true },
    email: { type: String, required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    title: { type: String, required: true },
    validUntil: Date,
    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Declined", "Cancelled", "Archived"],
      default: "Draft",
    },
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
schema.index(
  { shareTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { shareTokenHash: { $type: "string" } },
  },
);
schema.index(
  { documentNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { documentNumber: { $type: "string" } },
  },
);
module.exports =
  mongoose.models.Quotation || mongoose.model("Quotation", schema);
