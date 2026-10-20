const express = require("express");
const mongoose = require("mongoose");
const Quotation = require("../models/Quotation");
const QuoteTemplate = require("../models/QuoteTemplate");
const QuoteDelivery = require("../models/QuoteDelivery");
const StudioConfig = require("../models/StudioConfig");
const StudioContact = require("../models/StudioContact");
const StudioProject = require("../models/StudioProject");
const Lead = require("../models/Lead");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validate = require("../utils/studioRecords");
const { publicQuote } = require("../utils/quoteLifecycle");
const workflow = require("../services/quoteWorkflow");
const router = express.Router();
router.use(auth, requireAdmin);
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res
      .status(
        error.status ||
          (error.code === 11000
            ? 409
            : error.name === "CastError" || error.name === "ValidationError"
              ? 400
              : 500),
      )
      .json({
        error: error.status
          ? error.message
          : error.code === 11000
            ? "That document number or request already exists."
            : "Unable to complete quotation operation.",
      });
  }
};
async function getQuote(id) {
  if (!mongoose.isValidObjectId(id)) throw fail("Invalid quotation.");
  const q = await Quotation.findById(id);
  if (!q) throw fail("Quotation not found.", 404);
  return q;
}
async function references(values) {
  if (values.lead && !values.studioProjectId) {
    const enquiry = await Lead.findById(values.lead);
    if (enquiry?.studioProjectId) {
      values.studioProjectId = enquiry.studioProjectId;
      values.contactId = enquiry.contactId;
    }
  }
  for (const [key, Model] of [
    ["contactId", StudioContact],
    ["studioProjectId", StudioProject],
    ["lead", Lead],
  ]) {
    if (values[key] && !(await Model.exists({ _id: values[key] })))
      throw fail("Linked " + key + " does not exist.");
  }
  if (
    values.contactId &&
    values.studioProjectId &&
    !(await StudioProject.exists({
      _id: values.studioProjectId,
      $or: [
        { contactId: values.contactId },
        { additionalClients: values.contactId },
      ],
    }))
  )
    throw fail("Project is not linked to this contact.");
  if (values.studioProjectId) {
    values.lead = (await require("../services/enquiryPipeline").ensureProject(values.studioProjectId))._id;
  }
}
function valuesFromQuote(q, patch = {}) {
  const value = { ...(q.toObject ? q.toObject() : q), ...patch };
  for (const key of ["validUntil", "issueDate"])
    if (value[key] instanceof Date)
      value[key] = value[key].toISOString().slice(0, 10);
  for (const key of ["contactId", "studioProjectId", "lead"])
    if (value[key]) value[key] = String(value[key]._id || value[key]);
  return value;
}
async function editMetadata(q, values, message) {
  const updated = await Quotation.findOneAndUpdate(
    {
      _id: q._id,
      revision: q.revision,
      status: q.status,
      acceptedAt: { $exists: false },
    },
    {
      $set: { ...values, status: "Draft" },
      $inc: { revision: 1 },
      $unset: {
        shareToken: 1,
        shareTokenHash: 1,
        sharedAt: 1,
        expiredNotifiedAt: 1,
      },
      $push: { timeline: { kind: "revised", message, at: new Date() } },
    },
    { new: true, runValidators: true },
  );
  if (!updated)
    throw fail(
      "Accepted quotations are locked, or this quotation changed. Refresh and try again.",
      409,
    );
  await require("../services/enquiryPipeline").syncQuote(updated);
  return updated;
}
router.get(
  "/quotations/:id/preview",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    res.set("Cache-Control", "no-store");
    res.json({
      ...publicQuote(q, await StudioConfig.findOne({ key: "studio" })),
      preview: true,
    });
  }),
);
router.post(
  "/quotations/:id/share",
  wrap(async (req, res) => {
    const result = await workflow.shareQuote(req.params.id);
    res.json({ token: result.token, quote: workflow.safeQuote(result.quote) });
  }),
);
router.get(
  "/quotations/:id/email-history",
  wrap(async (req, res) => {
    await getQuote(req.params.id);
    res.json(
      await QuoteDelivery.find({ quotation: req.params.id })
        .sort({ createdAt: -1 })
        .limit(100),
    );
  }),
);
router.post(
  "/quotations/:id/email",
  wrap(async (req, res) => {
    const job = await workflow.queueEmail(
      await getQuote(req.params.id),
      req.body,
    );
    const result = await workflow.processDelivery(job._id);
    res
      .status(
        result.status === "sent"
          ? 200
          : result.status === "queued" || result.status === "processing"
            ? 202
            : 503,
      )
      .json({
        delivery: result,
        ...(result.status === "sent"
          ? {}
          : {
              error:
                result.error ||
                "Delivery is pending. Check email history before resending.",
            }),
      });
  }),
);
router.post(
  "/quotations/:id/schedule",
  wrap(async (req, res) => {
    if (!req.body?.scheduledFor)
      throw fail("Choose a scheduled date and time.");
    const delivery = await workflow.queueEmail(
      await getQuote(req.params.id),
      req.body,
      req.body.scheduledFor,
    );
    res.status(201).json({ delivery });
  }),
);
router.delete(
  "/quotations/:id/schedule",
  wrap(async (req, res) => {
    await getQuote(req.params.id);
    const result = await QuoteDelivery.updateMany(
      {
        quotation: req.params.id,
        kind: "email",
        status: "queued",
        dueAt: { $gt: new Date() },
      },
      {
        $set: {
          status: "cancelled",
          error: "Scheduled sending cancelled by the studio.",
        },
      },
    );
    res.json({ cancelled: result.modifiedCount });
  }),
);
router.post(
  "/quotations/:id/duplicate",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    const id = new mongoose.Types.ObjectId();
    const values = validate.quotation(
      valuesFromQuote(q, {
        status: "Draft",
        documentNumber: `TA-Q-${String(id).slice(-8).toUpperCase()}`,
        issueDate: new Date().toISOString().slice(0, 10),
      }),
    );
    res
      .status(201)
      .json(
        await Quotation.create({
          _id: id,
          ...values,
          revision: 1,
          history: [
            {
              revision: 1,
              status: "Draft",
              totalPaise: values.totalPaise,
              changedAt: new Date(),
            },
          ],
          timeline: [
            {
              kind: "created",
              message: "Draft quotation duplicated.",
              at: new Date(),
            },
          ],
        }),
      );
  }),
);
router.post(
  "/quotations/:id/cancel",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    if (q.status === "Accepted")
      throw fail(
        "Accepted quotations cannot be cancelled. Manage the linked invoice separately.",
        409,
      );
    const updated = await Quotation.findOneAndUpdate(
      {
        _id: q._id,
        revision: q.revision,
        status: { $in: ["Draft", "Sent", "Declined"] },
      },
      {
        $set: { status: "Cancelled", cancelledAt: new Date() },
        $unset: { shareToken: 1, shareTokenHash: 1 },
        $push: {
          timeline: {
            kind: "cancelled",
            message: "Quotation cancelled by the studio.",
            at: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!updated) throw fail("Quotation is already closed or changed.", 409);
    await QuoteDelivery.updateMany(
      { quotation: q._id, status: "queued" },
      { $set: { status: "cancelled", error: "Quotation cancelled." } },
    );
    await require("../services/enquiryPipeline").syncQuote(updated);
    res.json(updated);
  }),
);
router.post(
  "/quotations/:id/archive",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    const updated = await Quotation.findOneAndUpdate(
      { _id: q._id, revision: q.revision, status: q.status },
      {
        $set: { status: "Archived", archivedAt: new Date() },
        $unset: { shareToken: 1, shareTokenHash: 1 },
        $push: {
          timeline: {
            kind: "archived",
            message: "Quotation archived by the studio.",
            at: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!updated) throw fail("Quotation changed. Refresh and try again.", 409);
    await QuoteDelivery.updateMany(
      { quotation: q._id, status: "queued" },
      { $set: { status: "cancelled", error: "Quotation archived." } },
    );
    await require("../services/enquiryPipeline").syncQuote(updated);
    res.json(updated);
  }),
);
router.patch(
  "/quotations/:id/number",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    const values = validate.quoteMetadata(
      valuesFromQuote(q, { documentNumber: req.body.documentNumber }),
    );
    if (!values.documentNumber) throw fail("Enter a document number.");
    res.json(
      await editMetadata(
        q,
        { documentNumber: values.documentNumber },
        "Quotation number changed.",
      ),
    );
  }),
);
router.patch(
  "/quotations/:id/project",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    const metadata = validate.quoteMetadata(
      valuesFromQuote(q, {
        contactId: req.body.contactId ?? null,
        studioProjectId: req.body.studioProjectId ?? null,
      }),
    );
    const values = {
      contactId: metadata.contactId,
      studioProjectId: metadata.studioProjectId,
      ...(q.studioProjectId && !metadata.studioProjectId ? { lead: null } : {}),
    };
    await references(values);
    const updated = await Quotation.findOneAndUpdate(
      { _id: q._id, revision: q.revision },
      {
        $set: values,
        $push: {
          timeline: {
            kind: "linked",
            message: "Quotation project link updated.",
            at: new Date(),
          },
        },
      },
      { new: true },
    );
    if (!updated) throw fail("Quotation changed. Refresh and try again.", 409);
    await require("../services/enquiryPipeline").syncQuote(updated);
    if (q.studioProjectId && String(q.studioProjectId) !== String(updated.studioProjectId))
      await require("../services/enquiryPipeline").ensureProject(q.studioProjectId);
    res.json(updated);
  }),
);
router.put(
  "/quotations/:id/settings",
  wrap(async (req, res) => {
    const q = await getQuote(req.params.id);
    const values = validate.quoteMetadata(valuesFromQuote(q, req.body));
    await references(values);
    res.json(await editMetadata(q, values, "Quotation settings updated."));
  }),
);
function templateValues(body) {
  if (
    typeof body?.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 120
  )
    throw fail("Enter a template name up to 120 characters.");
  const validityDays = body.validityDays ?? 14;
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365)
    throw fail("Validity must be 1–365 days.");
  const q = validate.quotation({
    ...body,
    clientName: "Template",
    email: "template@example.com",
    lead: null,
    contactId: null,
    studioProjectId: null,
    status: "Draft",
    validUntil: null,
    issueDate: null,
  });
  const {
    title,
    items,
    discountPaise,
    discountType,
    discountValue,
    taxRateBps,
    terms,
    notes,
    design,
    autoCreateInvoice,
    expiryEnabled,
    remindersEnabled,
    reminderDays,
  } = q;
  return {
    name: body.name.trim(),
    validityDays,
    title,
    items,
    discountPaise,
    discountType,
    discountValue,
    taxRateBps,
    terms,
    notes,
    design,
    autoCreateInvoice,
    expiryEnabled,
    remindersEnabled,
    reminderDays,
  };
}
router.post(
  "/quote-templates",
  wrap(async (req, res) =>
    res.status(201).json(await QuoteTemplate.create(templateValues(req.body))),
  ),
);
router.get(
  "/quote-templates",
  wrap(async (req, res) =>
    res.json(await QuoteTemplate.find({ archived: false }).sort({ name: 1 })),
  ),
);
router.put(
  "/quote-templates/:id",
  wrap(async (req, res) => {
    const q = await QuoteTemplate.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: templateValues(req.body) },
      { new: true, runValidators: true },
    );
    if (!q) throw fail("Template not found.", 404);
    res.json(q);
  }),
);
router.delete(
  "/quote-templates/:id",
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      throw fail("Invalid template.");
    const q = await QuoteTemplate.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: { archived: true } },
      { new: true },
    );
    if (!q) throw fail("Template not found.", 404);
    res.json({ archived: true });
  }),
);
module.exports = router;
module.exports.references = references;
module.exports.templateValues = templateValues;
