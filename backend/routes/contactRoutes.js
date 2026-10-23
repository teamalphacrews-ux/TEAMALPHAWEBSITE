const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const Contact = require("../models/StudioContact");
const Project = require("../models/StudioProject");
const Document = require("../models/ContactDocument");
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Event = require("../models/Event");
const validate = require("../utils/contactRecords");
const pipeline = require("../services/enquiryPipeline");
const router = express.Router();
router.use(["/contacts", "/studio-projects", "/contact-documents"], auth, requireAdmin);
const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    res
      .status(
        err.status ||
          (err.name === "CastError" || err.name === "ValidationError"
            ? 400
            : 500),
      )
      .json({
        error: err.status ? err.message : "Unable to complete this operation",
      });
  }
};
const id = (req) => validate.identifier(req.params.id, "Record");
const requireContact = async (contactId, includeArchived = false) => {
  const contact = await Contact.findOne({
    _id: contactId,
    ...(!includeArchived ? { archived: { $ne: true } } : {}),
  });
  if (!contact) throw error("Contact not found", 404);
  return contact;
};
const projectLinks = async (values, existing) => {
  const primary = values.contactId || existing?.contactId;
  if (values.contactId) await requireContact(values.contactId);
  const additional =
    values.additionalClients || existing?.additionalClients || [];
  if (additional.some((other) => String(other) === String(primary)))
    throw error("Primary client cannot also be an additional client");
  if (values.additionalClients) {
    const count = await Contact.countDocuments({
      _id: { $in: values.additionalClients },
      archived: { $ne: true },
    });
    if (count !== values.additionalClients.length)
      throw error("An additional client could not be found");
  }
  const start = Object.hasOwn(values, "startDate")
    ? values.startDate
    : existing?.startDate;
  const end = Object.hasOwn(values, "endDate")
    ? values.endDate
    : existing?.endDate;
  if (start && end && new Date(end) < new Date(start))
    throw error("Project end date must follow its start date");
};
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function documentsFor(contact, studioProjectId) {
  const contactId = contact._id;
  const projectFilter = studioProjectId ? { studioProjectId } : { contactId };
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const quoteFilter = studioProjectId
    ? projectFilter
    : {
        $or: [
          { contactId },
          {
            contactId: null,
            email: new RegExp("^" + escaped(contact.email) + "$", "i"),
          },
        ],
      };
  const invoiceFilter = studioProjectId
    ? projectFilter
    : {
        $or: [
          { contactId },
          {
            contactId: null,
            clientName: new RegExp("^" + escaped(name) + "$", "i"),
          },
        ],
      };
  const [quotations, invoices, sessions, documents] = await Promise.all([
    Quotation.find(quoteFilter)
      .select(
        "title documentNumber issueDate acceptedAt expiryEnabled status totalPaise validUntil createdAt invoiceId contactId studioProjectId",
      )
      .sort({ createdAt: -1 })
      .lean(),
    Invoice.find(invoiceFilter)
      .select(
        "clientName invoiceNumber documentNumber invoiceDate dueDate documentStatus paymentScheduleEnabled paymentSchedule total advancePaid status contactId studioProjectId",
      )
      .sort({ createdAt: -1 })
      .lean(),
    Event.find(projectFilter)
      .select("title start end location type contactId studioProjectId")
      .sort({ start: -1 })
      .lean(),
    Document.find({ ...projectFilter, status: { $ne: "Archived" } })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);
  return { quotations, invoices, sessions, documents };
}
router.get(
  "/contacts",
  wrap(async (_req, res) =>
    res.json(
      await Contact.find({ archived: { $ne: true } })
        .sort({ createdAt: -1 })
        .lean(),
    ),
  ),
);
router.post(
  "/contacts",
  wrap(async (req, res) =>
    res.status(201).json(await Contact.create(validate.contact(req.body))),
  ),
);
router.get(
  "/contacts/:id",
  wrap(async (req, res) => {
    const contact = await requireContact(id(req), true);
    const [projects, related] = await Promise.all([
      Project.find({
        $or: [{ contactId: contact._id }, { additionalClients: contact._id }],
        status: { $ne: "Archived" },
      })
        .sort({ createdAt: -1 })
        .lean(),
      documentsFor(contact),
    ]);
    res.json({ contact, projects, ...related });
  }),
);
router.patch(
  "/contacts/:id",
  wrap(async (req, res) => {
    const record = await Contact.findOneAndUpdate(
      { _id: id(req) },
      { $set: validate.contact(req.body, true) },
      { new: true, runValidators: true },
    );
    if (!record) throw error("Contact not found", 404);
    await pipeline.syncContact(record._id);
    res.json(record);
  }),
);
router.get(
  "/studio-projects",
  wrap(async (_req, res) =>
    res.json(
      await Project.find({ status: { $ne: "Archived" } })
        .populate("contactId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean(),
    ),
  ),
);
router.post(
  "/studio-projects",
  wrap(async (req, res) => {
    const values = validate.project(req.body);
    await projectLinks(values);
    const project = await Project.create(values);
    const lead = await pipeline.ensureProject(project._id);
    project.leadId = lead._id;
    if (project.status === 'Booked') await require('../services/productionTemplates').applyDefaultProduction(lead._id);
    res.status(201).json(project);
  }),
);
router.get(
  "/studio-projects/:id",
  wrap(async (req, res) => {
    const project = await Project.findById(id(req))
      .populate("contactId")
      .populate("additionalClients", "firstName lastName email");
    if (!project) throw error("Project not found", 404);
    res.json({
      project,
      ...(await documentsFor(project.contactId, project._id)),
    });
  }),
);
router.patch(
  "/studio-projects/:id",
  wrap(async (req, res) => {
    const recordId = id(req),
      existing = await Project.findById(recordId);
    if (!existing) throw error("Project not found", 404);
    const values = validate.project(req.body, true);
    await projectLinks(values, existing);
    const project = await Project.findByIdAndUpdate(
        recordId,
        { $set: values },
        { new: true, runValidators: true },
      );
    const lead = await pipeline.ensureProject(project._id);
    project.leadId = lead._id;
    if (project.status === 'Booked' && existing.status !== 'Booked') await require('../services/productionTemplates').applyDefaultProduction(lead._id);
    res.json(project);
  }),
);
router.post(
  "/studio-projects/:id/notes",
  wrap(async (req, res) => {
    const note = validate.note(req.body);
    const project = await Project.findByIdAndUpdate(
      id(req),
      { $push: { notes: { $each: [note], $slice: -200 } } },
      { new: true, runValidators: true },
    );
    if (!project) throw error("Project not found", 404);
    res.status(201).json(project);
  }),
);
function documentFields(body) {
  const result = {
    contactId: validate.identifier(body.contactId, "Contact"),
    studioProjectId: body.studioProjectId
      ? validate.identifier(body.studioProjectId, "Project")
      : null,
    type: body.type,
  };
  if (!["Contract", "Questionnaire", "Message"].includes(result.type))
    throw error("Choose a supported document type");
  if (
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 200
  )
    throw error("Document title is required (up to 200 characters)");
  if (typeof body.content !== "string" || body.content.length > 50000)
    throw error("Document content must be text (up to 50,000 characters)");
  return {
    ...result,
    title: body.title.trim(),
    content: body.content,
    status: "Draft",
  };
}
const documentLinks = async (values) => {
  await requireContact(values.contactId);
  if (
    values.studioProjectId &&
    !(await Project.exists({
      _id: values.studioProjectId,
      $or: [
        { contactId: values.contactId },
        { additionalClients: values.contactId },
      ],
    }))
  )
    throw error("Project is not linked to this contact");
};
router.post(
  "/contact-documents",
  wrap(async (req, res) => {
    const values = documentFields(req.body);
    await documentLinks(values);
    res.status(201).json(await Document.create(values));
  }),
);
router.patch(
  "/contact-documents/:id",
  wrap(async (req, res) => {
    const values = documentFields(req.body);
    await documentLinks(values);
    const record = await Document.findOneAndUpdate(
      {
        _id: id(req),
        contactId: values.contactId,
        type: values.type,
        status: "Draft",
      },
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!record) throw error("Draft not found", 404);
    res.json(record);
  }),
);
module.exports = router;
