const { deletableInvoiceFilter } = require('../utils/invoiceDeletion');
const express = require("express");
const mongoose = require("mongoose");
const { createHash } = require("node:crypto");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const { invoiceIssuer } = require("../utils/invoiceBranding");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const invoiceValues = require("../utils/invoiceValues");
const {
  shareInvoice,
  sendInvoiceEmail,
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
      ...(err.status === 409 && typeof err.code === "string" ? { code: err.code } : {}),
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
function editConflict() {
  return Object.assign(new Error("This invoice changed while you were editing. Review the latest version before saving."), {
    status: 409,
    code: "invoice_edit_conflict",
  });
}
function checkEditVersion(body, invoice) {
  if (Object.hasOwn(body, "editVersion")) {
    if (!Number.isSafeInteger(body.editVersion) || body.editVersion < 0 ||
        body.editVersion !== (invoice.editVersion ?? 0)) throw editConflict();
    return;
  }
  if (body.updatedAt != null) {
    if (!invoice.updatedAt || new Date(body.updatedAt).getTime() !== +invoice.updatedAt) throw editConflict();
    return;
  }
  if (Object.hasOwn(body, "advancePaid") &&
      (Object.keys(body).some(key => key !== "advancePaid" && key !== "status") ||
       Number(body.advancePaid) < (invoice.advancePaid ?? 0))) {
    throw editConflict();
  }
}
function currentEditFilter(invoice) {
  const editVersion = invoice.editVersion ?? 0;
  return {
    _id: invoice._id,
    ...(editVersion ? { editVersion } : {
      $or: [{ editVersion: 0 }, { editVersion: { $exists: false } }],
    }),
    ...(invoice.updatedAt ? { updatedAt: invoice.updatedAt } : { updatedAt: { $exists: false } }),
  };
}
function invoiceCreationId(key, actorId) {
  if (key == null) return null;
  if (typeof key !== "string" || !/^[a-f0-9]{32}$/.test(key)) {
    throw Object.assign(new Error("Invalid invoice creation key."), { status: 400 });
  }
  // The collection is already workspace-scoped. The _id index is unique even
  // in older workspaces and across app instances.
  return createHash("sha256")
    .update(JSON.stringify(["studio-invoice-creation-v1", actorId, key]))
    .digest("hex")
    .slice(0, 24);
}
function sendCreationReplay(res, invoice) {
  return res.json({ ...invoice.toObject(), creationReplayed: true });
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
router.get("/register", wrap(async (req, res) => {
  const { listInvoiceRegister } = require("../utils/invoiceRegister");
  res.json(await listInvoiceRegister(Invoice, req.query));
}));
router.post(
  "/",
  wrap(async (req, res) => {
    const creationId = invoiceCreationId(req.body.creationKey, req.user.id);
    if (creationId) {
      const previous = await Invoice.findById(creationId);
      if (previous) return sendCreationReplay(res, previous);
    }
    const studio = await StudioConfig.findOne({ key: "studio" }) || {};
    const { invoiceWithDefaults, clientLinkOptions } = require('../utils/documentDefaults');
    const values = invoiceWithDefaults(req.body, studio, invoiceValues);
    if (values.discount > 0) await require('../services/studioSecurity').assertPermission(req.user.id, 'discounts');
    if (values.documentStatus === 'Sent') await require('../services/studioSecurity').assertPermission(req.user.id, 'invoiceIssue');
    if (!values.issuer)
      values.issuer = invoiceIssuer(
        studio,
      );
    await linked(values);
    const i = new Invoice(creationId ? { ...values, _id: creationId } : values);
    i.clientLinkOptions = clientLinkOptions(studio);
    const { nextDocumentNumber, persistNumberedInvoice } = require("../services/documentNumbering");
    let created = false;
    try {
      const save = async documentNumber => {
        if (documentNumber) i.documentNumber = documentNumber;
        const invoice = await i.save();
        created = true;
        return invoice;
      };
      const invoice = creationId && !i.documentNumber
        ? await persistNumberedInvoice({ invoiceId: creationId, studio, date: i.invoiceDate, persist: save })
        : await save(i.documentNumber || await nextDocumentNumber("invoice", studio, i.invoiceDate, Invoice));
      if (!created) return sendCreationReplay(res, invoice);
      res.status(201).json(invoice);
    } catch (err) {
      if (creationId && err.code === 11000) {
        const previous = await Invoice.findById(creationId);
        if (previous) return sendCreationReplay(res, previous);
      }
      throw err;
    }
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
    checkEditVersion(req.body, i);
    const values = invoiceValues(req.body, i.toObject());
    if (values.discountType !== i.discountType || Number(values.discountValue || 0) !== Number(i.discountValue ?? i.discount ?? 0)) await require('../services/studioSecurity').assertPermission(req.user.id, 'discounts');
    if (values.documentStatus === 'Sent' && i.documentStatus !== 'Sent') await require('../services/studioSecurity').assertPermission(req.user.id, 'invoiceIssue');
    if (!values.issuer)
      values.issuer = invoiceIssuer(
        (await StudioConfig.findOne({ key: "studio" })) || {},
      );
    await linked(values);
    const updated = await Invoice.findOneAndUpdate(
      currentEditFilter(i),
      { $set: values, $inc: { editVersion: 1 } },
      { new: true, runValidators: true },
    );
    if (!updated) throw editConflict();
    res.json(updated);
  }),
);
router.post(
  "/:id/approve",
  require('../services/studioSecurity').requirePermission('invoiceIssue'),
  wrap(async (req, res) => {
    const invoice = await load(req.params.id);
    checkEditVersion(req.body || {}, invoice);
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
        ...currentEditFilter(invoice),
        status: { $ne: "Cancelled" },
        documentStatus: { $ne: "Cancelled" },
      },
      {
        $inc: { editVersion: 1 },
        $set: {
          ...values,
          documentStatus: "Sent",
          approvedAt: invoice.approvedAt || new Date(),
        },
      },
      { new: true, runValidators: true },
    );
    if (!issued) throw editConflict();
    res.json(issued);
  }),
);
router.post(
  "/:id/share",
  require('../services/studioSecurity').requirePermission('invoiceIssue'),
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
      { $unset: { shareToken: 1, shareTokenHash: 1 }, $set: { linkRevokedAt: new Date() } },
    );
    res.json({ message: "Invoice link revoked" });
  }),
);
router.post('/:id/share/regenerate', require('../services/studioSecurity').requirePermission('invoiceIssue'), wrap(async (req, res) => {
  const invoice = await load(req.params.id);
  if (invoice.status === 'Cancelled' || invoice.documentStatus !== 'Sent') return res.status(409).json({ error: 'Issue this invoice before regenerating its link.' });
  const token = require('../saas/publicTokens').createShareToken();
  const options = require('../utils/documentDefaults').clientLinkOptions(await StudioConfig.findOne({ key: 'studio' }) || {});
  if (!options.showPayments) return res.status(409).json({ error: 'Enable client payment visibility in studio settings before regenerating this invoice link.' });
  const result = await Invoice.updateOne({ _id: invoice._id, documentStatus: 'Sent', status: { $ne: 'Cancelled' } }, { $set: { shareToken: token, shareTokenHash: require('../utils/quoteLifecycle').tokenHash(token), clientLinkOptions: options, sharedAt: new Date(), ...(options.linkExpiryDays ? { linkExpiresAt: new Date(Date.now() + options.linkExpiryDays * 86400000) } : {}) }, $unset: { linkRevokedAt: 1, ...(options.linkExpiryDays ? {} : { linkExpiresAt: 1 }) } });
  if (!result.matchedCount) return res.status(409).json({ error: 'Invoice changed. Reload before regenerating its link.' });
  res.json({ url: `${require('../services/studioMailer').frontendOrigin()}/invoice/${token}`, message: 'New invoice link created. The previous link is no longer valid.' });
}));
router.post(
  "/:id/send",
  require('../services/studioSecurity').requirePermission('invoiceIssue'),
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
              requestedBy: req.user.id,
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
    if (i.discount > 0) await require('../services/studioSecurity').assertPermission(req.user.id, 'discounts');
    const values = invoiceValues({
      ...i.toObject(),
      documentNumber: "",
      documentStatus: "Draft",
      status: "Pending",
      advancePaid: 0,
    });
    const copy = new Invoice(values);
    const studio = await StudioConfig.findOne({ key: 'studio' }) || {};
    copy.clientLinkOptions = require('../utils/documentDefaults').clientLinkOptions(studio);
    copy.documentNumber = await require('../services/documentNumbering').nextDocumentNumber('invoice', studio, copy.invoiceDate, Invoice);
    await copy.save();
    res.status(201).json(copy);
  }),
);
router.delete(
  "/:id",
  require('../services/studioSecurity').requirePermission('deletion'),
  wrap(async (req, res) => {
    const i = await load(req.params.id);
    if (
      i.sourceQuotation ||
      i.documentStatus !== "Draft" ||
      i.approvedAt ||
      i.status === "Cancelled" ||
      i.advancePaid > 0 ||
      i.sharedAt ||
      i.status === "Paid"
    )
      return res.status(409).json({
        error:
          "Only an unissued, unshared draft without payments or a source quotation can be deleted.",
      });
    const deleted = await require('../services/studioRecovery').recoverableDelete({ Model: Invoice, filter: deletableInvoiceFilter(i._id), actorId: req.user.id, label: `Invoice ${i.documentNumber || i._id}` });
    if (!deleted) return res.status(409).json({ error: 'Invoice changed before deletion. Reload and try again.' });
    res.json({ message: "Invoice deleted" });
  }),
);
module.exports = router;
