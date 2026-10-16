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
const validToken = (t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t);
async function find(token) {
  return validToken(token)
    ? Quotation.findOne({
        shareTokenHash: tokenHash(token),
        status: { $in: ["Sent", "Accepted"] },
      })
    : null;
}
async function ensureInvoice(q) {
  // The acceptance claim reserves a single invoice ID atomically. An interrupted
  // request can safely retry this insert without requiring replica-set transactions.
  return Invoice.findOneAndUpdate(
    { _id: q.invoiceId },
    { $setOnInsert: invoiceFromQuote(q) },
    { upsert: true, new: true, runValidators: true },
  );
}
router.get(
  "/:token",
  wrap(async (req, res) => {
    const q = await find(req.params.token);
    if (!q)
      return res
        .status(404)
        .json({
          error:
            "This quotation link is unavailable. Please contact the studio.",
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
        return res
          .status(410)
          .json({
            error:
              "This quotation has expired. Please ask the studio for a new quotation.",
          });
      if (body.revision !== q.revision)
        return res
          .status(409)
          .json({
            error:
              "The quotation changed. Reload and review it before accepting.",
          });
      const now = new Date();
      const claimed = await Quotation.findOneAndUpdate(
        {
          _id: q._id,
          status: "Sent",
          revision: body.revision,
          shareTokenHash: tokenHash(req.params.token),
          validUntil: { $gt: new Date(now.getTime() - 18.5 * 3600000) },
        },
        {
          $set: {
            status: "Accepted",
            acceptedAt: now,
            acceptedBy: body.acceptedBy.trim(),
            invoiceId: new mongoose.Types.ObjectId(),
          },
        },
        { new: true, runValidators: true },
      );
      q = claimed || (await find(req.params.token));
      if (!q || q.status !== "Accepted")
        return res
          .status(409)
          .json({
            error:
              "The quotation changed. Reload and review it before accepting.",
          });
    }
    if (!q.invoiceId)
      return res
        .status(409)
        .json({
          error: "Please contact the studio about this accepted quotation.",
        });
    await ensureInvoice(q);
    q = await Quotation.findOneAndUpdate(
      { _id: q._id, status: "Accepted" },
      { $set: { invoiceGeneratedAt: q.invoiceGeneratedAt || new Date() } },
      { new: true },
    );
    res.json(publicQuote(q, await StudioConfig.findOne({ key: "studio" })));
  }),
);
module.exports = router;
