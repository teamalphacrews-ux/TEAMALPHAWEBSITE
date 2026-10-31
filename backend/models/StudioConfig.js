const mongoose = require("mongoose");
const { DEFAULTS, clone } = require('../utils/studioSettings');
const nested = fields => new mongoose.Schema(fields, { _id: false });
const milestone = nested({ label: String, percent: Number, offsetDays: Number });
const stage = nested({ title: String, category: String, dueDays: Number, clientVisible: Boolean });
const template = nested({ id: String, name: String, stages: [stage] });
const billing = nested({ quotationPrefix: String, invoicePrefix: String, numberingMode: String, includeFinancialYear: Boolean, defaultTaxPercent: Number, defaultDiscountType: String, defaultDiscountValue: Number, invoiceDueDays: Number, paymentScheduleEnabled: Boolean, paymentMilestones: [milestone] });
const automation = nested({ autoCreateInvoice: Boolean, invoiceApprovalRequired: { type: Boolean, default: true }, quoteRemindersEnabled: Boolean, quoteReminderDays: [Number], invoiceRemindersEnabled: Boolean, invoiceReminderDays: [Number], notifyQuoteAccepted: Boolean, notifyPaymentOverdue: Boolean, notifyAssignments: Boolean, notifyDeliveryDue: Boolean, dailyDigestEnabled: Boolean, dailyDigestHour: Number });
const communication = nested({ senderName: String, replyTo: String, quoteSubject: String, quoteMessage: String, invoiceSubject: String, invoiceMessage: String, supportHours: String });
const clientLinks = nested({ showCrew: Boolean, showProgress: Boolean, showDeliverables: Boolean, showPayments: Boolean, allowChat: Boolean, linkExpiryDays: Number });
const security = nested({ idleTimeoutMinutes: Number, absoluteSessionHours: Number, permissions: nested({ discounts: String, deletion: String, exports: String, invoiceIssue: String }) });
const backups = nested({ enabled: Boolean, frequency: String, retentionDays: Number });
const schema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "studio" },
    studioName: { type: String, default: "Team Alpha" },
    legalName: { type: String, default: '' },
    gstin: { type: String, default: '' },
    profilePhotoUrl: { type: String, default: '' },
    logoUrl: { type: String, default: '/assets/team-alpha-logo-20261021.png' },
    whatsappNumber: { type: String, default: '' },
    whatsappMessage: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    facebookUrl: { type: String, default: '' },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    invoicePrefix: { type: String, default: "TA" },
    quotationValidityDays: { type: Number, default: 14 },
    quotationTerms: { type: String, default: "" },
    paymentInstructions: { type: String, default: "" },
    coverImage: {type:String,default:"/assets/banner.jpg"},
    colorTheme: {type:String,default:"#202622"},
    fontTheme: {type:String,default:"modern"},
    bankDetails: {type:String,default:""},
    upiId: {type:String,default:""},
    defaultDeliverables: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    billingDefaults: { type: billing, default: () => clone(DEFAULTS.billingDefaults) },
    automation: { type: automation, default: () => clone(DEFAULTS.automation) },
    communication: { type: communication, default: () => clone(DEFAULTS.communication) },
    productionDefaults: { type: nested({ defaultTemplateId: String, templates: [template] }), default: () => clone(DEFAULTS.productionDefaults) },
    clientLinkDefaults: { type: clientLinks, default: () => clone(DEFAULTS.clientLinkDefaults) },
    security: { type: security, default: () => clone(DEFAULTS.security) },
    backups: { type: backups, default: () => clone(DEFAULTS.backups) },
  },
  { timestamps: true },
);
module.exports =
  mongoose.models.StudioConfig || mongoose.model("StudioConfig", schema);
