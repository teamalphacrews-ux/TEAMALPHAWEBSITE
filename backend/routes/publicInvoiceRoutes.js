const express = require("express");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const { tokenHash } = require("../utils/quoteLifecycle");
const { invoiceIssuer } = require("../utils/invoiceBranding");
const router = express.Router();
function publicInvoice(i, studio) {
  return {
    _id: i._id,
    documentNumber:
      i.documentNumber || `INV-${String(i._id).slice(-8).toUpperCase()}`,
    documentStatus: i.documentStatus,
    clientName: i.clientName,
    clientAddress: i.clientAddress,
    title: i.title,
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate,
    items: i.items,
    events: i.events,
    deliverables: i.deliverables,
    deliverablesPrice: i.deliverablesPrice,
    discount: i.discount,
    discountType: i.discountType,
    discountValue: i.discountValue,
    extraCharges:
      !i.items?.length && i.sourceQuotation && i.taxAmount
        ? Math.max(0, Number(i.extraCharges || 0) - Number(i.taxAmount))
        : i.extraCharges,
    taxAmount: i.taxAmount,
    taxRateBps: i.taxRateBps,
    total: i.total,
    advancePaid: i.status === "Paid" ? i.total : i.advancePaid,
    status: i.status,
    notes: i.notes,
    terms: i.terms,
    currency: "INR",
    design: i.design,
    paymentScheduleEnabled: i.paymentScheduleEnabled,
    paymentSchedule: i.paymentSchedule,
    acceptedPaymentMethods: i.acceptedPaymentMethods,
    allowTip: i.allowTip,
    studio: invoiceIssuer(studio || {}, i.issuer?.toObject?.() || i.issuer || {}),
  };
}
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  next();
});
router.get("/:token", async (req, res) => {
  try {
    if (!require("../saas/publicTokens").isShareToken(req.params.token))
      return res
        .status(404)
        .json({ error: "This invoice link is unavailable." });
    const invoice = await Invoice.findOne({
      shareTokenHash: tokenHash(req.params.token),
      documentStatus: "Sent",
      status: { $ne: "Cancelled" },
    });
    if (!invoice || invoice.clientLinkOptions?.showPayments === false || !require('../utils/documentDefaults').linkIsActive(invoice))
      return res.status(404).json({
        error: "This invoice link is unavailable. Please contact the studio.",
      });
    res.json(
      publicInvoice(invoice, await StudioConfig.findOne({ key: "studio" })),
    );
  } catch {
    res
      .status(503)
      .json({ error: "The invoice could not be loaded. Please retry." });
  }
});
module.exports = router;
module.exports.publicInvoice = publicInvoice;
