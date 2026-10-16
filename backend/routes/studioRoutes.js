const express = require("express");
const bcrypt = require("bcryptjs");
const Quotation = require("../models/Quotation");
const AssetRecord = require("../models/AssetRecord");
const StudioConfig = require("../models/StudioConfig");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Finance = require("../models/Finance");
const Invoice = require("../models/Invoice");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const validate = require("../utils/studioRecords");
const crypto = require("crypto");
const QuoteTemplate = require("../models/QuoteTemplate");
const { expired, tokenHash } = require("../utils/quoteLifecycle");
const router = express.Router();
router.use(auth, requireAdmin);
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res
      .status(
        error.status ||
          (error.code === 11000
            ? 409
            : error.name === "ValidationError" || error.name === "CastError"
              ? 400
              : 500),
      )
      .json({
        error: error.status
          ? error.message
          : error.code === 11000
            ? "A record with this email already exists"
            : "Unable to complete this operation",
      });
  }
};
const project = async (id) => {
  if (id && !(await Lead.exists({ _id: id })))
    throw Object.assign(new Error("Project not found"), { status: 400 });
};
const uniqueClientEmail = async (email, id) => {
  const pattern = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    email: new RegExp("^" + pattern + "$", "i"),
    ...(id ? { _id: { $ne: id } } : {}),
  };
  if (await User.exists(filter))
    throw Object.assign(
      new Error("A client account already exists with this email"),
      { status: 409 },
    );
};
const notFound = () =>
  Object.assign(new Error("Record not found"), { status: 404 });
router.patch(
  "/booking-payments/:id",
  wrap(async (req, res) => {
    const values = validate.bookingPayment(req.body);
    const record = await Lead.findOneAndUpdate(
      { _id: req.params.id, status: "Converted" },
      { $set: values },
      { new: true, runValidators: true },
    ).select("name totalAmount depositAmount paymentStatus status");
    if (!record) throw notFound();
    res.json(record);
  }),
);
router.get(
  "/finance",
  wrap(async (req, res) => {
    const [leads, invoices, entries] = await Promise.all([
      Lead.find()
        .select("name status totalAmount depositAmount paymentStatus eventDate")
        .lean(),
      Invoice.find()
        .select("clientName invoiceDate total advancePaid status")
        .sort({ invoiceDate: -1 })
        .lean(),
      Finance.find().sort({ date: -1 }).lean(),
    ]);
    res.json({ leads, invoices, entries });
  }),
);
router.post(
  "/ledger",
  wrap(async (req, res) =>
    res.status(201).json(await Finance.create(validate.ledger(req.body))),
  ),
);
router.put(
  "/ledger/:id",
  wrap(async (req, res) => {
    const values = validate.ledger(req.body);
    if (values.type !== "expense")
      throw Object.assign(
        new Error("An expense cannot change transaction type"),
        { status: 400 },
      );
    const result = await Finance.findOneAndUpdate(
      { _id: req.params.id, type: "expense" },
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!result) throw notFound();
    res.json(result);
  }),
);
router.delete(
  "/ledger/:id",
  wrap(async (req, res) => {
    const result = await Finance.findOneAndDelete({
      _id: req.params.id,
      type: "expense",
    });
    if (!result) throw notFound();
    res.json({ removed: true });
  }),
);
router.get(
  "/settings",
  wrap(async (req, res) =>
    res.json(
      (await StudioConfig.findOne({ key: "studio" })) || new StudioConfig(),
    ),
  ),
);
router.put(
  "/settings",
  wrap(async (req, res) =>
    res.json(
      await StudioConfig.findOneAndUpdate(
        { key: "studio" },
        { $set: validate.settings(req.body) },
        { upsert: true, new: true, runValidators: true },
      ),
    ),
  ),
);
router.get(
  "/clients",
  wrap(async (req, res) =>
    res.json(
      await User.find({ role: "client" })
        .select("firstName lastName email leadId cloudLink createdAt updatedAt")
        .populate(
          "leadId",
          "name status eventDate eventType eventLocation totalAmount paymentStatus",
        )
        .sort({ createdAt: -1 }),
    ),
  ),
);
router.post(
  "/clients",
  wrap(async (req, res) => {
    const values = validate.client(req.body, true);
    await project(values.leadId);
    await uniqueClientEmail(values.email);
    const password = await bcrypt.hash(values.password, 10);
    const user = await User.create({ ...values, password, role: "client" });
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      leadId: user.leadId,
      cloudLink: user.cloudLink,
      createdAt: user.createdAt,
    });
  }),
);
router.patch(
  "/clients/:id",
  wrap(async (req, res) => {
    const values = validate.client(req.body);
    await uniqueClientEmail(values.email, req.params.id);
    await project(values.leadId);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "client" },
      { $set: values },
      { new: true, runValidators: true },
    )
      .select("firstName lastName email leadId cloudLink createdAt updatedAt")
      .populate(
        "leadId",
        "name status eventDate eventType eventLocation totalAmount paymentStatus",
      );
    if (!user) throw notFound();
    res.json(user);
  }),
);
router.get(
  "/quotations",
  wrap(async (req, res) =>
    res.json(
      await Quotation.find()
        .populate("lead", "name email eventDate")
        .sort({ updatedAt: -1 }),
    ),
  ),
);
router.post(
  "/quotations",
  wrap(async (req, res) => {
    const values = validate.quotation(req.body);
    if (["Sent", "Accepted"].includes(values.status))
      throw Object.assign(
        new Error(
          "Use Share for client review. Acceptance is recorded from the client link.",
        ),
        { status: 400 },
      );
    await project(values.lead);
    res.status(201).json(
      await Quotation.create({
        ...values,
        history: [
          {
            revision: 1,
            status: values.status,
            totalPaise: values.totalPaise,
            changedAt: new Date(),
          },
        ],
      }),
    );
  }),
);
router.put(
  "/quotations/:id",
  wrap(async (req, res) => {
    const values = validate.quotation(req.body);
    if (["Sent", "Accepted"].includes(values.status))
      throw Object.assign(
        new Error(
          "Use Share for client review. Acceptance is recorded from the client link.",
        ),
        { status: 400 },
      );
    await project(values.lead);
    // Atomic revision guard prevents one editor from overwriting another's saved proposal.
    if (!Number.isSafeInteger(req.body.revision))
      throw Object.assign(new Error("A revision is required"), { status: 400 });
    const quote = await Quotation.findOneAndUpdate(
      {
        _id: req.params.id,
        revision: req.body.revision,
        status: { $ne: "Accepted" },
      },
      {
        $set: {
          ...values,
          status: values.status === "Archived" ? "Archived" : "Draft",
        },
        $unset: { shareToken: 1, shareTokenHash: 1, sharedAt: 1 },
        $inc: { revision: 1 },
        $push: {
          history: {
            $each: [
              {
                revision: req.body.revision + 1,
                status: values.status,
                totalPaise: values.totalPaise,
                changedAt: new Date(),
              },
            ],
            $slice: -30,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!quote)
      throw Object.assign(
        new Error("This quotation changed. Refresh and try again."),
        { status: 409 },
      );
    res.json(quote);
  }),
);

router.post(
  "/quotations/:id/share",
  wrap(async (req, res) => {
    const q = await Quotation.findById(req.params.id).select(
      "+shareToken +shareTokenHash",
    );
    if (!q) throw notFound();
    if (!["Draft", "Sent"].includes(q.status) || expired(q))
      throw Object.assign(
        new Error(
          "Set a future expiry date on an open quotation before sharing.",
        ),
        { status: 400 },
      );
    const token = q.shareToken || crypto.randomBytes(32).toString("hex");
    const result = await Quotation.findOneAndUpdate(
      { _id: q._id, revision: q.revision, status: q.status },
      {
        $set: {
          status: "Sent",
          shareToken: token,
          shareTokenHash: tokenHash(token),
          sharedAt: q.sharedAt || new Date(),
        },
      },
      { new: true },
    );
    if (!result)
      throw Object.assign(
        new Error("This quotation changed. Refresh and try again."),
        { status: 409 },
      );
    res.json({ token, quote: result });
  }),
);
const templateValues = (body) => {
  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.trim().length > 120
  )
    throw Object.assign(
      new Error("Enter a template name up to 120 characters."),
      { status: 400 },
    );
  const validityDays = body.validityDays ?? 14;
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365)
    throw Object.assign(new Error("Validity must be 1–365 days."), {
      status: 400,
    });
  const q = validate.quotation({
    ...body,
    clientName: "Template",
    email: "template@example.com",
    lead: null,
    status: "Draft",
    validUntil: null,
  });
  return {
    name: body.name.trim(),
    title: q.title,
    items: q.items,
    discountPaise: q.discountPaise,
    taxRateBps: q.taxRateBps,
    terms: q.terms,
    validityDays,
  };
};
router.get(
  "/quote-templates",
  wrap(async (req, res) =>
    res.json(await QuoteTemplate.find({ archived: false }).sort({ name: 1 })),
  ),
);
router.post(
  "/quote-templates",
  wrap(async (req, res) =>
    res.status(201).json(await QuoteTemplate.create(templateValues(req.body))),
  ),
);
router.put(
  "/quote-templates/:id",
  wrap(async (req, res) => {
    const record = await QuoteTemplate.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: templateValues(req.body) },
      { new: true, runValidators: true },
    );
    if (!record) throw notFound();
    res.json(record);
  }),
);
router.delete(
  "/quote-templates/:id",
  wrap(async (req, res) => {
    const record = await QuoteTemplate.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: { archived: true } },
      { new: true },
    );
    if (!record) throw notFound();
    res.json({ archived: true });
  }),
);

router.get(
  "/assets",
  wrap(async (req, res) =>
    res.json(
      await AssetRecord.find({ archived: false })
        .populate("lead", "name eventDate")
        .sort({ updatedAt: -1 }),
    ),
  ),
);
router.post(
  "/assets",
  wrap(async (req, res) => {
    const values = validate.asset(req.body);
    await project(values.lead);
    res.status(201).json(await AssetRecord.create(values));
  }),
);
router.put(
  "/assets/:id",
  wrap(async (req, res) => {
    const values = validate.asset(req.body);
    await project(values.lead);
    const previous = await AssetRecord.findOne({
      _id: req.params.id,
      archived: false,
    });
    if (
      previous &&
      previous.backupStatus === "Verified" &&
      values.backupStatus === "Verified" &&
      values.storageLocation === previous.storageLocation &&
      values.backupLocation === previous.backupLocation
    )
      values.verifiedAt = previous.verifiedAt;
    const record = await AssetRecord.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!record) throw notFound();
    res.json(record);
  }),
);
router.delete(
  "/assets/:id",
  wrap(async (req, res) => {
    const record = await AssetRecord.findOneAndUpdate(
      { _id: req.params.id, archived: false },
      { $set: { archived: true } },
      { new: true },
    );
    if (!record) throw notFound();
    res.json({ archived: true });
  }),
);
module.exports = router;
