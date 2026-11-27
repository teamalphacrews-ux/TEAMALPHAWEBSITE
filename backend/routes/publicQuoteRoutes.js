const express = require("express");
const mongoose = require("mongoose");
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const {
  expired,
  tokenHash,
  invoiceFromQuote,
  publicQuote,
} = require("../utils/quoteLifecycle");
const { acceptedQuoteDestination } = require('../utils/acceptedQuoteDestination');
const productionTemplates = require('../services/productionTemplates');
const router = express.Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  next();
});
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch {
    res
      .status(503)
      .json({ error: "Unable to complete this request. Please retry." });
  }
};
const validToken = (t) => require("../saas/publicTokens").isShareToken(t);
async function find(token) {
  const quote = validToken(token)
    ? Quotation.findOne({
        shareTokenHash: tokenHash(token),
        status: { $in: ["Sent", "Accepted"] },
      })
    : null;
  const result = await quote;
  return result && require('../utils/documentDefaults').linkIsActive(result) ? result : null;
}
async function ensureInvoice(q) {
  const studio = await StudioConfig.findOne({ key: 'studio' }) || {};
  const values = invoiceFromQuote(q, studio);
  return require('../services/documentNumbering').persistNumberedInvoice({
    invoiceId: q.invoiceId,
    studio,
    date: q.acceptedAt,
    persist: async documentNumber => {
      const now = new Date();
      try {
        return await Invoice.findOneAndUpdate(
          { _id: q.invoiceId },
          { $setOnInsert: { ...values, documentNumber, createdAt: now, updatedAt: now } },
          { upsert: true, new: true, runValidators: true, timestamps: false },
        );
      } catch (error) {
        if (error.code === 11000) {
          const existing = await Invoice.findById(q.invoiceId);
          if (existing) return existing;
        }
        throw error;
      }
    },
  });
}
router.get(
  "/:token",
  wrap(async (req, res) => {
    const q = await find(req.params.token);
    if (!q)
      return res.status(404).json({
        error: "This quotation link is unavailable. Please contact the studio.",
      });
    res.json(publicQuote(q, await StudioConfig.findOne({ key: "studio" })));
  }),
);
router.post(
  "/:token/accept",
  wrap(async (req, res) => {
    const body = req.body;
    if (
      !body ||
      body.consent !== true ||
      typeof body.acceptedBy !== "string" ||
      !body.acceptedBy.trim() ||
      body.acceptedBy.trim().length > 120 ||
      /[\x00-\x1f]/.test(body.acceptedBy)
    )
      return res
        .status(400)
        .json({ error: "Enter your name and confirm the quotation terms." });
    let q = await find(req.params.token);
    if (!q)
      return res
        .status(404)
        .json({ error: "This quotation link is unavailable." });
    if (q.status !== "Accepted") {
      if (expired(q))
        return res.status(410).json({
          error:
            "This quotation has expired. Please ask the studio for a new quotation.",
        });
      if (body.revision !== q.revision)
        return res.status(409).json({
          error:
            "The quotation changed. Reload and review it before accepting.",
        });
      const template = q.lead || q.studioProjectId
        ? productionTemplates.savedTemplate(await StudioConfig.findOne({ key: 'studio' }))
        : undefined;
      const now = new Date();
      const claimed = await Quotation.findOneAndUpdate(
        {
          _id: q._id,
          status: "Sent",
          revision: body.revision,
          shareTokenHash: tokenHash(req.params.token),
          ...(q.expiryEnabled === false
            ? {}
            : {
                validUntil: { $gt: new Date(now.getTime() - 18.5 * 3600000) },
              }),
        },
        {
          $set: {
            status: "Accepted",
            acceptedAt: now,
            acceptedBy: body.acceptedBy.trim(),
            ...(template ? { pendingProductionTemplate: template } : {}),
            ...(q.autoCreateInvoice === false
              ? {}
              : { invoiceId: new mongoose.Types.ObjectId() }),
          },
          $push: {
            timeline: {
              kind: "accepted",
              message: "Quotation accepted by client.",
              at: now,
            },
          },
        },
        { new: true, runValidators: true },
      );
      q = claimed || (await find(req.params.token));
      if (!q || q.status !== "Accepted")
        return res.status(409).json({
          error:
            "The quotation changed. Reload and review it before accepting.",
        });
    }
    if (q.autoCreateInvoice !== false && !q.invoiceId)
      return res.status(409).json({
        error: "Please contact the studio about this accepted quotation.",
      });
    const linkedEnquiry = await require("../services/enquiryPipeline").syncQuote(q);
    if (q.pendingProductionTemplate) {
      if (!linkedEnquiry?._id) throw new Error('Production setup is missing its linked enquiry.');
      await productionTemplates.finishAcceptedProduction(q._id, linkedEnquiry._id);
    }
    if (q.autoCreateInvoice !== false && !q.invoiceGeneratedAt) {
      await ensureInvoice(q);
      q = await Quotation.findOneAndUpdate(
        { _id: q._id, status: "Accepted", invoiceGeneratedAt: null },
        { $set: { invoiceGeneratedAt: new Date() } },
        { new: true },
      ) || await find(req.params.token);
      if (!q) return res.status(404).json({ error: "This quotation link is unavailable." });
    }
    if (req.app) {
      const Notification = require("../models/Notification");
      if (!q.acceptedNotifiedAt) {
        const studioSettings = await StudioConfig.findOne({ key: 'studio' });
        const eventKey = 'quote-accepted:' + q._id;
        let recorded = studioSettings?.automation?.notifyQuoteAccepted === false;
        if (!recorded) {
          try {
            await Notification.create({
              eventKey,
              title: 'Quotation accepted',
              description: `${q.clientName} accepted quotation ${q.documentNumber || String(q._id).slice(-6).toUpperCase()}.`,
              type: 'System',
              link: acceptedQuoteDestination(q, '/admin/quotations'),
            });
            recorded = true;
          } catch (error) {
            // A concurrent acceptance or the automation worker may have inserted this event.
            recorded = error.code === 11000 && error.keyValue?.eventKey === eventKey;
          }
        }
        if (recorded) {
          await Quotation.findOneAndUpdate(
            { _id: q._id, status: 'Accepted', acceptedNotifiedAt: { $exists: false } },
            { $set: { acceptedNotifiedAt: new Date() } },
          );
        }
      }
      if (
        !q.emailConfirmationStatus ||
        ["none", "unavailable", "failed"].includes(q.emailConfirmationStatus)
      ) {
        const status =
          await require("../services/quoteWorkflow").queueConfirmation(q);
        q = await Quotation.findOneAndUpdate(
          { _id: q._id, status: "Accepted", emailConfirmationStatus: { $in: [null, "none", "unavailable", "failed"] } },
          { $set: { emailConfirmationStatus: status } },
          { new: true },
        ) || await find(req.params.token);
        if (!q) return res.status(404).json({ error: "This quotation link is unavailable." });
      }
    }
    res.json(publicQuote(q, await StudioConfig.findOne({ key: "studio" })));
  }),
);
router.use(require('./publicProjectRoutes'));
module.exports = router;
