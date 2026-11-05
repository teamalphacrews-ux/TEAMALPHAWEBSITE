const mongoose = require("mongoose");
const invoiceSchema = new mongoose.Schema(
  {
    sourceQuotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      immutable: true,
    },
    sourceRevision: Number,
    sourceQuoteNumber: String,
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "StudioContact" },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    studioProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudioProject",
    },
    documentNumber: String,
    documentStatus: {
      type: String,
      enum: ["Draft", "Sent", "Cancelled"],
      default: "Draft",
    },
    clientName: { type: String, required: true },
    clientEmail: String,
    clientPhone: String,
    clientAddress: String,
    title: String,
    issuer: {
      type: new mongoose.Schema({
        name: String, address: String, email: String, phone: String,
        website: String, taxId: String, logoUrl: String,
        paymentInstructions: String, bankDetails: String, upiId: String,
      }, { _id: false }),
      default: undefined,
    },
    invoiceDate: { type: Date, required: true },
    dueDate: Date,
    items: [
      {
        title: String,
        description: String,
        quantity: Number,
        unitPricePaise: Number,
      },
    ],
    events: [
      {
        eventName: String,
        services: String,
        equipment: String,
        dateLocation: String,
        price: Number,
      },
    ],
    deliverables: { type: [String], default: [] },
    deliverablesPrice: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    discountValue: Number,
    discount: { type: Number, default: 0 },
    taxRateBps: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    extraCharges: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    notes: String,
    terms: String,
    currency: { type: String, default: "INR" },
    timeline: [{ deliverable: String, time: String }],
    paymentScheduleEnabled: { type: Boolean, default: false },
    paymentSchedule: [{ label: String, amountPaise: Number, dueDate: Date }],
    acceptedPaymentMethods: {
      type: [String],
      default: ["BANKING", "G-pay", "UPI"],
    },
    paymentReminders: { type: Boolean, default: false },
    reminderOffsets: { type: [Number], default: [-7, 0, 3, 7, 14] },
    allowTip: { type: Boolean, default: false },
    design: {
      coverUrl: String,
      accentColor: String,
      fontFamily: String,
      showLogo: { type: Boolean, default: true },
    },
    shareToken: { type: String, select: false },
    shareTokenHash: { type: String, select: false },
    sharedAt: Date,
    linkExpiresAt: Date,
    linkRevokedAt: Date,
    clientLinkOptions: { type: require('./documentLinkOptions'), default: undefined },
    approvedAt: Date,
    scheduledDelivery: {
      requestedBy: String,
      at: Date,
      subject: String,
      message: String,
      sendCopy: Boolean,
      state: String,
      error: String,
      claimAt: Date,
    },
    deliveries: [
      {
        sentAt: Date,
        channel: String,
        subject: String,
        state: String,
        error: String,
      },
    ],
    reminderLog: [String],
    deliveryRequests: [{ key: String, state: String, at: Date }],
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true },
);
invoiceSchema.index(
  { sourceQuotation: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceQuotation: { $type: "objectId" } },
  },
);
invoiceSchema.index({ shareTokenHash: 1 }, { unique: true, sparse: true });
module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
