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
        .select("clientName invoiceDate total advancePaid status documentStatus dueDate paymentScheduleEnabled paymentSchedule currency")
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
    const result = await require('../services/studioRecovery').recoverableDelete({ Model: Finance, filter: { _id: req.params.id, type: 'expense' }, actorId: req.user.id });
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
  wrap(async (req, res) => {
    if (req.body?.security !== undefined || req.body?.backups !== undefined)
      await require('../services/studioSecurity').assertOwner(req.user.id);
    res.json(await StudioConfig.findOneAndUpdate(
        { key: "studio" },
        { $set: validate.settings(req.body) },
        { upsert: true, new: true, runValidators: true },
      ));
  }),
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
    if (["Sent", "Accepted"].includes(req.body?.status)) throw Object.assign(new Error("Use Share for client review. Acceptance is recorded from the client link."), { status: 400 });
    const studio = await StudioConfig.findOne({ key: "studio" }) || {};
    const { quoteDefaults, clientLinkOptions } = require("../utils/documentDefaults");
    const { invoiceIssuer } = require("../utils/invoiceBranding");
    const values = validate.quotation({ ...quoteDefaults(studio, req.body.issueDate || new Date()), ...req.body });
    if (values.discountPaise > 0) await require('../services/studioSecurity').assertPermission(req.user.id, 'discounts');
    if (["Sent", "Accepted"].includes(values.status))
      throw Object.assign(
        new Error(
          "Use Share for client review. Acceptance is recorded from the client link.",
        ),
        { status: 400 },
      );
    await require("./quoteWorkflowRoutes").references(values);
    const documentNumber = values.documentNumber || await require("../services/documentNumbering").nextDocumentNumber("quotation", studio, values.issueDate, Quotation);
    const quote = await Quotation.create({
        ...values,
        documentNumber,
        issuer: values.issuer || invoiceIssuer(studio),
        clientLinkOptions: clientLinkOptions(studio),
        issueDate: values.issueDate || new Date().toISOString().slice(0,10),
        timeline: [{kind:"created",message:"Draft quote created.",at:new Date()}],
        history: [
          {
            revision: 1,
            status: values.status,
            totalPaise: values.totalPaise,
            changedAt: new Date(),
          },
        ],
      });
    await require("../services/enquiryPipeline").syncQuote(quote);
    res.status(201).json(quote);
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
    await require("./quoteWorkflowRoutes").references(values);
    // Atomic revision guard prevents one editor from overwriting another's saved proposal.
    if (!Number.isSafeInteger(req.body.revision))
      throw Object.assign(new Error("A revision is required"), { status: 400 });
    const previous = await Quotation.findById(req.params.id);
    if (!previous) throw notFound();
    if (previous.discountType !== values.discountType || Number(previous.discountValue || 0) !== Number(values.discountValue || 0) || Number(previous.discountPaise || 0) !== Number(values.discountPaise || 0))
      await require('../services/studioSecurity').assertPermission(req.user.id, 'discounts');
    const quote = await Quotation.findOneAndUpdate(
      {
        _id: req.params.id,
        revision: req.body.revision,
        status: { $ne: "Accepted" },
        acceptedAt: {$exists:false},
      },
      {
        $set: {
          ...values,
          status: ["Archived","Cancelled","Declined"].includes(values.status) ? values.status : "Draft",
        },
        $unset: { shareToken: 1, shareTokenHash: 1, sharedAt: 1, expiredNotifiedAt:1 },
        $inc: { revision: 1 },
        $push: {
          timeline: {kind:"revised",message:"Quotation revised.",at:new Date()},
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
    await require("../services/enquiryPipeline").syncQuote(quote);
    res.json(quote);
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
    await require("./quoteWorkflowRoutes").references(values);
    res.status(201).json(await AssetRecord.create(values));
  }),
);
router.put(
  "/assets/:id",
  wrap(async (req, res) => {
    const values = validate.asset(req.body);
    await require("./quoteWorkflowRoutes").references(values);
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
    await require('../services/studioSecurity').assertPermission(req.user.id, 'deletion');
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
