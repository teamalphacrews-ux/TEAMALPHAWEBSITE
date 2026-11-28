const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const Contact = require("../models/StudioContact");
const Project = require("../models/StudioProject");
const Document = require("../models/ContactDocument");
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Event = require("../models/Event");
const Lead = require("../models/Lead");
const WhatsAppConversation = require("../models/WhatsAppConversation");
const validate = require("../utils/contactRecords");
const { manualCreation } = require('../utils/manualCreation');
const pipeline = require("../services/enquiryPipeline");
const modules = require('../utils/moduleAccess');
const { withRecordDeletion } = require("../services/studioArchiveGate");
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
const requireContact = async (contactId, includeArchived = false, session) => {
  const contact = await Contact.findOne({
    _id: contactId,
    ...(!includeArchived ? { archived: { $ne: true } } : {}),
  }, null, { session });
  if (!contact) throw error("Contact not found", 404);
  return contact;
};
const projectLinks = async (values, existing, session) => {
  const primary = values.contactId || existing?.contactId;
  if (values.contactId) await requireContact(values.contactId, false, session);
  const additional =
    values.additionalClients || existing?.additionalClients || [];
  if (additional.some((other) => String(other) === String(primary)))
    throw error("Primary client cannot also be an additional client");
  if (values.additionalClients) {
    const count = await Contact.countDocuments({
      _id: { $in: values.additionalClients },
      archived: { $ne: true },
    }, { session });
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
async function contactFinancialFilters(contact, session) {
  const direct = { contactId: contact._id };
  const filters = { quoteFilter: direct, invoiceFilter: direct };
  if (!contact.email) return filters;

  const email = new RegExp('^' + escaped(contact.email) + '$', 'i');
  // Legacy standalone documents lack durable links. A name alone or a shared
  // address cannot establish which contact owns billing history.
  if (await Contact.countDocuments({ email }, session ? { session } : undefined) !== 1) return filters;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const standalone = { contactId: null, studioProjectId: null, clientName: new RegExp('^' + escaped(name) + '$', 'i') };
  return {
    quoteFilter: { $or: [direct, { ...standalone, lead: null, email }] },
    invoiceFilter: { $or: [direct, { ...standalone, leadId: null, sourceQuotation: null, clientEmail: email }] },
  };
}

async function documentsFor(contact, studioProjectId, user) {
  const projectFilter = studioProjectId ? { studioProjectId } : { contactId: contact._id };
  const { quoteFilter, invoiceFilter } = !studioProjectId && (modules.hasModule(user, 'quotations') || modules.hasModule(user, 'invoices'))
    ? await contactFinancialFilters(contact)
    : { quoteFilter: projectFilter, invoiceFilter: projectFilter };
  const [quotations, invoices, sessions, documents] = await Promise.all([
    modules.hasModule(user, 'quotations') ? Quotation.find(quoteFilter)
      .select(
        "title documentNumber issueDate acceptedAt expiryEnabled status totalPaise validUntil createdAt invoiceId contactId studioProjectId",
      )
      .sort({ createdAt: -1 })
      .lean() : [],
    modules.hasModule(user, 'invoices') ? Invoice.find(invoiceFilter)
      .select(
        "clientName invoiceNumber documentNumber invoiceDate dueDate documentStatus paymentScheduleEnabled paymentSchedule total advancePaid status contactId studioProjectId",
      )
      .sort({ createdAt: -1 })
      .lean() : [],
    modules.hasModule(user, 'calendar') ? Event.find(projectFilter)
      .select("title start end location type contactId studioProjectId description teamMembers lead")
      .sort({ start: -1 })
      .lean() : [],
    modules.hasModule(user, 'contacts') ? Document.find({ ...projectFilter, status: { $ne: "Archived" } })
      .sort({ updatedAt: -1 })
      .lean() : [],
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
  wrap(async (req, res) => {
    const values = validate.contact(req.body);
    const { record, replayed } = await manualCreation(req, Contact, async session => {
      if (!session) return Contact.create(values);
      const [contact] = await Contact.create([values], { session });
      return contact;
    });
    res.status(replayed ? 200 : 201).json(record);
  }),
);
router.get(
  "/contacts/:id",
  wrap(async (req, res) => {
    const contact = await requireContact(id(req), true);
    const [projects, related] = await Promise.all([
      modules.hasModule(req.user, 'projects') ? Project.find({
        $or: [{ contactId: contact._id }, { additionalClients: contact._id }],
        status: { $ne: "Archived" },
      })
        .sort({ createdAt: -1 })
        .lean() : [],
      documentsFor(contact, undefined, req.user),
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
router.delete(
  "/contacts/:id",
  wrap(async (req, res) => {
    const recordId = id(req);
    const contact = await withRecordDeletion(() => require("../services/studioRecovery").recoverableDelete({
      Model: Contact,
      filter: { _id: recordId },
      actorId: req.user.id,
      beforeDelete: async ({ row, session }) => {
        const contactId = row._id;
        const { quoteFilter, invoiceFilter } = await contactFinancialFilters(row, session);
        const relationships = [
          [Project, { $or: [{ contactId }, { additionalClients: contactId }] }],
          [Lead, { contactId }],
          [Quotation, quoteFilter],
          [Invoice, invoiceFilter],
          [Event, { contactId }],
          [Document, { contactId }],
          [WhatsAppConversation, { contactId }],
        ];
        for (const [Model, filter] of relationships) {
          if (await Model.exists(filter).session(session)) {
            throw error("This contact has linked records. Archive the contact to keep its history.", 409);
          }
        }
      },
    }));
    if (!contact) throw error("Contact not found", 404);
    res.json({ success: true });
  }),
);
router.get(
  "/studio-projects",
  wrap(async (req, res) =>
    res.json(
      await Project.find({ status: { $ne: "Archived" } })
        .populate("contactId", modules.hasModule(req.user, "contacts") ? "firstName lastName email phone" : "_id")
        .sort({ createdAt: -1 })
        .lean(),
    ),
  ),
);
router.post(
  "/studio-projects",
  wrap(async (req, res) => {
    const values = validate.project(req.body);
    const save = async session => {
      await projectLinks(values, null, session);
      const [created] = await Project.create([values], { session });
      const lead = await pipeline.ensureProject(created._id, session);
      created.leadId = lead._id;
      if (created.status === 'Booked') await require('../services/productionTemplates').applyDefaultProduction(lead._id, session);
      return created;
    };
    const { record, replayed } = await manualCreation(req, Project, session =>
      session ? save(session) : Project.db.transaction(save));
    res.status(replayed ? 200 : 201).json(record);
  }),
);
router.get(
  "/studio-projects/:id",
  wrap(async (req, res) => {
    const project = await Project.findById(id(req))
      .populate("contactId", modules.hasModule(req.user, "contacts") ? undefined : "_id")
      .populate("additionalClients", modules.hasModule(req.user, "contacts") ? "firstName lastName email" : "_id");
    if (!project) throw error("Project not found", 404);
    const [related,production]=await Promise.all([documentsFor(project.contactId,project._id,req.user),require('../services/projectWorkspace').productionFor(project)]);
    res.json({project,...related,production});
  }),
);
router.patch('/studio-projects/:id/crew',wrap(async(req,res)=>{
 const action=req.body?.action;
 if(!['assign','remove'].includes(action))throw error('Choose assign or remove.');
 const photographerId=validate.identifier(req.body?.photographerId,'Crew member'),project=await Project.findById(id(req));
 if(!project)throw error('Project not found',404);
 if(project.status==='Archived')throw error('Restore this project before changing its crew.',409);
 const production=await require('../services/projectWorkspace').productionFor(project);
 if(!production.lead)throw error('Review this project’s enquiry connection before changing crew.',409);
 const Photographer=require('../models/Photographer'),Lead=require('../models/Lead');
 const person=await Photographer.findById(photographerId).select('name status').lean();
 if(!person)throw error('Crew member not found',404);
 if(action==='assign'&&person.status==='Inactive')throw error('Choose an active crew member.');
 if(await Photographer.countDocuments({name:person.name})!==1)throw error('Give each crew member a distinct name before assigning.',409);
 const filter={_id:production.lead._id,contactId:project.contactId,$or:[{studioProjectId:project._id},{studioProjectId:null}]};
 const result=await Lead.updateOne(filter,action==='assign'?{$addToSet:{people:person.name}}:{$pull:{people:person.name}});
 if(!result.matchedCount)throw error('The project connection changed. Refresh and try again.',409);
 res.json({success:true});
}));
router.patch(
  "/studio-projects/:id",
  wrap(async (req, res) => {
    const recordId = id(req);
    const values = validate.project(req.body, true);
    const project = await Project.db.transaction(async session => {
      const existing = await Project.findById(recordId, null, { session });
      if (!existing) throw error("Project not found", 404);
      await projectLinks(values, existing, session);
      const updated = await Project.findByIdAndUpdate(
        recordId,
        { $set: values }, { new: true, runValidators: true, session },
      );
      if (!updated) throw error('The project changed. Refresh and try again.', 409);
      const lead = await pipeline.ensureProject(updated._id, session);
      updated.leadId = lead._id;
      if (updated.status === 'Booked' && existing.status !== 'Booked') {
        await require('../services/productionTemplates').applyDefaultProduction(lead._id, session);
      }
      return updated;
    });
    res.json(project);
  }),
);
router.delete(
  "/studio-projects/:id",
  wrap(async (req, res) => {
    const projectId = id(req);
    const project = await withRecordDeletion(() => require("../services/projectDeletion").deleteProject({
      projectId,
      actorId: req.user.id,
    }));
    if (!project) throw error("Project not found", 404);
    res.json({ message: "Project moved to recovery." });
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
function documentFields(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw error("A document is required");
  const values = {};
  if (!partial || Object.hasOwn(body, "contactId"))
    values.contactId = validate.identifier(body.contactId, "Contact");
  if (!partial || Object.hasOwn(body, "type")) {
    if (!["Contract", "Questionnaire", "Message"].includes(body.type))
      throw error("Choose a supported document type");
    values.type = body.type;
  }
  if (Object.hasOwn(body, "studioProjectId")) {
    values.studioProjectId = body.studioProjectId === null || body.studioProjectId === ""
      ? null : validate.identifier(body.studioProjectId, "Project");
  }
  if (!partial || Object.hasOwn(body, "title")) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200)
      throw error("Document title is required (up to 200 characters)");
    values.title = body.title.trim();
  }
  if (!partial || Object.hasOwn(body, "content")) {
    if (typeof body.content !== "string" || body.content.length > 50000)
      throw error("Document content must be text (up to 50,000 characters)");
    values.content = body.content;
  }
  return values;
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
    res.status(201).json(await Document.create({ ...values, status: "Draft" }));
  }),
);
router.patch(
  "/contact-documents/:id",
  wrap(async (req, res) => {
    const { contactId, type, ...updates } = documentFields(req.body, true);
    if (!Object.keys(updates).length) throw error("Supply a draft field to update");
    const filter = { _id: id(req), status: "Draft" };
    if (contactId) filter.contactId = contactId;
    if (type) filter.type = type;
    const draft = await Document.findOne(filter);
    if (!draft) throw error("Draft not found", 404);
    await documentLinks({
      contactId: draft.contactId,
      studioProjectId: Object.hasOwn(updates, "studioProjectId") ? updates.studioProjectId : draft.studioProjectId,
    });
    const record = await Document.findOneAndUpdate(
      { ...filter, contactId: draft.contactId, type: draft.type },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!record) throw error("Draft not found", 404);
    res.json(record);
  }),
);
module.exports = router;
