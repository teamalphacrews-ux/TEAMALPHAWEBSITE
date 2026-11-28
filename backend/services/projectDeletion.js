const Project = require('../models/StudioProject');
const Lead = require('../models/Lead');
const Contact = require('../models/StudioContact');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Finance = require('../models/Finance');
const Event = require('../models/Event');
const Document = require('../models/ContactDocument');
const Task = require('../models/Task');
const Asset = require('../models/AssetRecord');
const { recoverableDelete } = require('./studioRecovery');

const conflict = message => Object.assign(new Error(message), { status: 409 });
const sameId = (a, b) => String(a) === String(b);

async function detachUnusedProject({ row, session }) {
  const studioProjectId = row._id;
  const lead = await Lead.findOne({ studioProjectId }).session(session).lean();
  const supportedLink = lead && row.leadId && sameId(lead._id, row.leadId) && sameId(lead.contactId, row.contactId);
  if ((lead || row.leadId) && !supportedLink)
    throw conflict('Review this project’s enquiry connection before deleting it. You can archive the project instead.');

  const directLink = { studioProjectId };
  const withEnquiry = field => lead ? { $or: [directLink, { [field]: lead._id }] } : directLink;
  const checks = [
    [Quotation, withEnquiry('lead')],
    [Invoice, withEnquiry('leadId')],
    [Finance, directLink],
    [Event, withEnquiry('lead')],
    [Document, directLink],
  ];
  if (lead) checks.push([Task, { lead: lead._id }], [Asset, { lead: lead._id }]);

  const linked = () => conflict('This project has linked records or production work. Archive it to keep its history.');
  if (lead && (lead.quotationId || lead.quotationStatus || lead.quotationNumber || lead.totalAmount || lead.depositAmount ||
    (lead.paymentStatus && lead.paymentStatus !== 'Unpaid') || lead.people?.length ||
    lead.tasks?.length || lead.galleryTag || lead.cloudLink || lead.cloudPassword))
    throw linked();

  for (const [Model, filter] of checks) {
    if (await Model.exists(filter).session(session)) throw linked();
  }

  if (lead) {
    // Keep the enquiry available independently of the unused project.
    const result = await Lead.updateOne(
      { _id: lead._id, studioProjectId, contactId: row.contactId },
      { $unset: { studioProjectId: '' } },
      { session },
    );
    if (result.matchedCount !== 1) throw conflict('The project connection changed. Refresh and try again.');
  }
}

async function deleteProject({ projectId, actorId }) {
  return recoverableDelete({
    Model: Project,
    filter: { _id: projectId },
    actorId,
    beforeDelete: detachUnusedProject,
  });
}

async function restoreProjectEnquiry(project, session) {
  const clientIds = [...new Set([project.contactId, ...(project.additionalClients || [])])];
  const clients = await Contact.countDocuments({ _id: { $in: clientIds } }).session(session);
  if (clients !== clientIds.length)
    throw conflict('Restore this project’s client contacts before restoring the project.');

  if (!project.leadId) return;
  const unavailable = () => conflict('This project’s enquiry is no longer available for this project. Review the enquiry before restoring it.');
  const result = await Lead.updateOne(
    { _id: project.leadId, contactId: project.contactId, $or: [{ studioProjectId: null }, { studioProjectId: project._id }] },
    { $set: { studioProjectId: project._id } },
    { session },
  ).catch(error => {
    if (error.code === 11000) throw unavailable();
    throw error;
  });
  if (result.matchedCount !== 1) throw unavailable();
}

module.exports = { deleteProject, detachUnusedProject, restoreProjectEnquiry };
