const express = require("express");
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const { invoiceIssuer } = require("../utils/invoiceBranding");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const invoiceValues = require("../utils/invoiceValues");
const {
  shareInvoice,
  sendInvoiceEmail,
  invoiceNumber,
} = require("../services/invoiceDelivery");
const { mailerReady } = require("../services/studioMailer");
const router = express.Router();
router.use(auth, requireAdmin);
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    res.status(err.status || (err.name === "CastError" ? 404 : 500)).json({
      error: err.status
        ? err.message
        : "Unable to complete invoice request. Please retry.",
    });
  }
};
async function load(id, token = false) {
  if (!mongoose.isValidObjectId(id))
    throw Object.assign(new Error("Invoice not found"), { status: 404 });
  const query = Invoice.findById(id);
  const i = await (token ? query.select("+shareToken +shareTokenHash") : query);
  if (!i) throw Object.assign(new Error("Invoice not found"), { status: 404 });
  return i;
}
async function linked(values) {
  for (const [key, model] of [
    ["contactId", "StudioContact"],
    ["leadId", "Lead"],
    ["studioProjectId", "StudioProject"],
  ])
    if (values[key]) {
      const Model = require(`../models/${model}`);
      if (!(await Model.exists({ _id: values[key] })))
        throw Object.assign(
          new Error("Linked contact or project was not found"),
          { status: 400 },
        );
    }
}
router.get(
  "/",
  wrap(async (req, res) => {
    res.json(await Invoice.find().sort({ createdAt: -1 }));
  }),
);
router.get("/delivery-status", (req, res) =>
  res.json({ emailConfigured: mailerReady(), scheduledEmailSupported: true }),
);
router.post(
  "/",
  wrap(async (req, res) => {
    const values = invoiceValues(req.body);
    if (!values.issuer)
      values.issuer = invoiceIssuer(
        (await StudioConfig.findOne({ key: "studio" })) || {},
      );
    await linked(values);
    const i = new Invoice(values);
    if (!i.documentNumber) i.documentNumber = invoiceNumber(i);
    await i.save();
    res.status(201).json(i);
  }),
);
router.get(
  "/:id",
  wrap(async (req, res) => res.json(await load(req.params.id))),
);
router.put(
  "/:id",
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    const values = invoiceValues(req.body, i.toObject());
    if (!values.issuer)
      values.issuer = invoiceIssuer(
        (await StudioConfig.findOne({ key: "studio" })) || {},
      );
    await linked(values);
    res.json(
      await Invoice.findByIdAndUpdate(
        i._id,
        { $set: values },
        { new: true, runValidators: true },
      ),
    );
  }),
);
router.post(
  "/:id/approve",
  wrap(async (req, res) => {
    const invoice = await load(req.params.id);
    if (
      invoice.status === "Cancelled" ||
      invoice.documentStatus === "Cancelled"
    )
      return res
        .status(409)
        .json({ error: "Cancelled invoices cannot be issued." });
    const values = invoiceValues({}, invoice.toObject());
    if (!values.issuer)
      values.issuer = invoiceIssuer(
        (await StudioConfig.findOne({ key: "studio" })) || {},
      );
    const issued = await Invoice.findOneAndUpdate(
      {
        _id: invoice._id,
        status: { $ne: "Cancelled" },
        documentStatus: { $ne: "Cancelled" },
        ...(invoice.updatedAt ? { updatedAt: invoice.updatedAt } : {}),
      },
      {
        $set: {
          ...values,
          documentStatus: "Sent",
          approvedAt: invoice.approvedAt || new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (!issued)
      return res
        .status(409)
        .json({ error: "The invoice changed. Reload before issuing it." });
    res.json(issued);
  }),
);
router.post(
  "/:id/share",
  wrap(async (req, res) => {
    const invoice = await load(req.params.id, true);
    const url = await shareInvoice(invoice);
    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $push: {
          deliveries: {
            $each: [{ sentAt: new Date(), channel: "link", state: "shared" }],
            $slice: -50,
          },
        },
      },
    );
    res.json({
      url,
      message: "Invoice marked as sent. Share this link with your client.",
    });
  }),
);
router.delete(
  "/:id/share",
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    await Invoice.updateOne(
      { _id: i._id },
      { $unset: { shareToken: 1, shareTokenHash: 1 } },
    );
    res.json({ message: "Invoice link revoked" });
  }),
);
router.post(
  "/:id/send",
  wrap(async (req, res) => {
    const invoice = await load(req.params.id, true);
    if (
      invoice.status === "Cancelled" ||
      invoice.documentStatus === "Cancelled"
    )
      return res
        .status(409)
        .json({ error: "Cancelled invoices cannot be sent" });
    if (
      req.body.subject != null &&
      (typeof req.body.subject !== "string" ||
        req.body.subject.length > 200 ||
        /[\x00-\x1f\x7f]/.test(req.body.subject))
    )
      return res.status(400).json({
        error: "Use a subject without line breaks and up to 200 characters",
      });
    if (
      req.body.message != null &&
      (typeof req.body.message !== "string" || req.body.message.length > 12000)
    )
      return res
        .status(400)
        .json({ error: "Message must be up to 12000 characters" });
    if (req.body.scheduledAt) {
      if (!mailerReady())
        return res
          .status(503)
          .json({ error: "Configure studio email before scheduling delivery" });
      if (!invoice.clientEmail)
        return res
          .status(400)
          .json({ error: "Add a client email before scheduling delivery" });
      const at = new Date(req.body.scheduledAt);
      if (
        !Number.isFinite(+at) ||
        at < new Date(Date.now() + 60000) ||
        at > new Date(Date.now() + 366 * 86400000)
      )
        return res.status(400).json({
          error: "Schedule delivery from one minute to one year from now",
        });
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            scheduledDelivery: {
              at,
              subject: String(req.body.subject || "").slice(0, 200),
              message: String(req.body.message || "").slice(0, 12000),
              sendCopy: req.body.sendCopy === true,
              state: "scheduled",
            },
          },
        },
      );
      return res.json({ message: "Invoice email scheduled", scheduledAt: at });
    }
    if (
      typeof req.body.requestId !== "string" ||
      !/^[a-zA-Z0-9:_-]{8,120}$/.test(req.body.requestId)
    )
      return res
        .status(400)
        .json({ error: "A delivery request ID is required" });
    res.json(
      await sendInvoiceEmail(invoice, {
        subject: req.body.subject,
        message: req.body.message,
        sendCopy: req.body.sendCopy === true,
        requestId: req.body.requestId,
      }),
    );
  }),
);
router.delete(
  "/:id/scheduled-delivery",
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    await Invoice.updateOne(
      { _id: i._id, "scheduledDelivery.state": "scheduled" },
      { $set: { "scheduledDelivery.state": "cancelled" } },
    );
    res.json({ message: "Scheduled delivery cancelled" });
  }),
);
router.post(
  "/:id/duplicate",
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    const values = invoiceValues({
      ...i.toObject(),
      documentNumber: "",
      documentStatus: "Draft",
      status: "Pending",
      advancePaid: 0,
    });
    const copy = new Invoice(values);
    copy.documentNumber = invoiceNumber(copy);
    await copy.save();
    res.status(201).json(copy);
  }),
);
router.delete(
  "/:id",
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    if (
      i.sourceQuotation ||
      i.documentStatus === "Sent" ||
      i.sharedAt ||
      i.status === "Paid"
    )
      return res.status(409).json({
        error:
          "Sent, paid or quotation-linked invoices can be cancelled, but not deleted.",
      });
    await Invoice.findByIdAndDelete(i._id);
    res.json({ message: "Invoice deleted" });
  }),
);
module.exports = router;
