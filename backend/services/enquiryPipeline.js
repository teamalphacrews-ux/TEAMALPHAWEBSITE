// A studio project owns one CRM enquiry. Contacts may have several projects.
// Keep document identity/payment snapshots separate from this live pipeline view.
const same = (a, b) => String(a?._id || a || "") === String(b?._id || b || "");
const id = value => value?._id || value;
const fail = message => Object.assign(new Error(message), { status: 409 });
function authoritativeQuote(quotes) {
  const rank = { Accepted: 3, Sent: 2, Draft: 1 };
  return quotes.filter(q => rank[q.status]).sort((a, b) =>
    rank[b.status] - rank[a.status] || new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  )[0];
}
function stageFor(project, quote, current = "New") {
  if (current === "Archived" || project.status === "Archived") return "Archived";
  if (current === "Converted" || ["Booked", "Completed"].includes(project.status) || quote?.status === "Accepted") return "Converted";
  return quote?.status === "Sent" ? "Negotiation" : current;
}
function createPipeline({ Lead, Project, Contact, Quotation, Event }) {
  async function ensureProject(value) {
    const project = await Project.findById(id(value));
    if (!project) throw fail("The linked project could not be found.");
    const contact = await Contact.findById(id(project.contactId));
    if (!contact) throw fail("The project's primary contact could not be found.");
    let lead = await Lead.findOne({ studioProjectId: project._id });
    const linkedQuotes = await Quotation.find({ studioProjectId: project._id });
    const explicitLinks = [...new Set([project.leadId, ...linkedQuotes.map(q => q.lead)].filter(Boolean).map(value => String(id(value))))];
    if (explicitLinks.some(value => lead && !same(value, lead._id)) || (!lead && explicitLinks.length > 1))
      throw fail("This project has conflicting enquiry links. Review them before continuing.");
    if (!lead) {
      const quotes = await Quotation.find({ studioProjectId: project._id });
      const candidateId = project.leadId || quotes.find(q => q.lead)?.lead;
      if (candidateId) {
        const candidate = await Lead.findById(id(candidateId));
        if (candidate) {
          if ((candidate.studioProjectId && !same(candidate.studioProjectId, project._id)) || candidate.email?.toLowerCase() !== contact.email?.toLowerCase())
            throw fail("This project refers to a different enquiry. Review its client and enquiry links.");
          try {
            lead = await Lead.findOneAndUpdate({ _id: candidate._id, $or: [{ studioProjectId: null }, { studioProjectId: project._id }] }, { $set: { studioProjectId: project._id } }, { new: true });
          } catch (err) { if (err.code !== 11000) throw err; }
        }
      }
      if (!lead) {
        try {
          lead = await Lead.findOneAndUpdate({ studioProjectId: project._id }, { $setOnInsert: {
            name: [contact.firstName, contact.lastName].filter(Boolean).join(" "), email: contact.email,
            phone: contact.phone || "", status: "New", contactId: contact._id, studioProjectId: project._id,
          } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
        } catch (err) {
          if (err.code !== 11000) throw err;
          lead = await Lead.findOne({ studioProjectId: project._id });
        }
      }
    }
    if (!lead) throw fail("Enquiry linking changed. Please retry.");
    // Re-read document authority and guard the previous stage so a simultaneous
    // share can never downgrade a booking recorded by client acceptance.
    for (let attempt = 0; attempt < 4; attempt++) {
      const quote = authoritativeQuote(await Quotation.find({ studioProjectId: project._id }));
      const values = {
        contactId: contact._id, projectName: project.name,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        email: contact.email, phone: contact.phone || "", eventType: project.type || "",
        eventDate: project.startDate || null, eventLocation: project.location || "",
        status: stageFor(project, quote, lead.status),
      };
      if (quote && (lead.status !== "Converted" || quote.status === "Accepted")) {
        Object.assign(values, { quotationId: quote._id, quotationStatus: quote.status,
          quotationNumber: quote.documentNumber || "", totalAmount: quote.totalPaise / 100 });
      } else if (!quote && lead.status !== "Converted") {
        Object.assign(values, { quotationId: null, quotationStatus: "", quotationNumber: "" });
      }
      const updated = await Lead.findOneAndUpdate({ _id: lead._id, status: lead.status }, { $set: values }, { new: true, runValidators: true });
      if (updated) { lead = updated; break; }
      lead = await Lead.findById(lead._id);
      if (!lead) throw fail("The enquiry was removed while linking. Please retry.");
      if (attempt === 3) throw fail("The enquiry changed. Please retry.");
    }
    await Project.updateOne({ _id: project._id }, { $set: { leadId: lead._id } });
    await Quotation.updateMany({ studioProjectId: project._id, lead: { $ne: lead._id } }, { $set: { lead: lead._id } });
    if (Event) await Event.updateMany({ studioProjectId: project._id, lead: { $ne: lead._id } }, { $set: { lead: lead._id } });
    if (lead.status === "Converted") await Project.updateOne({ _id: project._id, status: "Inquiry" }, { $set: { status: "Booked" } });
    return lead;
  }
  async function syncQuote(quote) {
    if (quote.studioProjectId) {
      const lead = await ensureProject(quote.studioProjectId);
      quote.lead = lead._id;
      return lead;
    }
    if (!quote.lead) return null;
    let lead = await Lead.findById(id(quote.lead));
    if (!lead) throw fail("The linked enquiry could not be found.");
    if (lead.studioProjectId) return ensureProject(lead.studioProjectId);
    for (let attempt = 0; attempt < 4; attempt++) {
    const values = {};
    if (["Sent", "Accepted"].includes(quote.status) && lead.status !== "Archived") {
      values.status = lead.status === "Converted" || quote.status === "Accepted" ? "Converted" : "Negotiation";
      if (lead.status !== "Converted" || quote.status === "Accepted") Object.assign(values, {
        quotationId: quote._id, quotationStatus: quote.status, quotationNumber: quote.documentNumber || "", totalAmount: quote.totalPaise / 100,
      });
    }
    if (!Object.keys(values).length) return lead;
    const updated = await Lead.findOneAndUpdate({ _id: lead._id, status: lead.status }, { $set: values }, { new: true, runValidators: true });
    if (updated) return updated;
    lead = await Lead.findById(lead._id);
    if (!lead) throw fail("The linked enquiry could not be found.");
    }
    throw fail("The enquiry changed. Please retry.");
  }
  async function syncContact(contactId) {
    for (const project of await Project.find({ contactId })) await ensureProject(project._id);
    const contact = await Contact.findById(contactId);
    if (contact) await Lead.updateMany({ contactId, studioProjectId: null }, { $set: {
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "), email: contact.email, phone: contact.phone || "",
    } });
  }
  async function reconcile() {
    // Read repair covers projects created before the unified workflow was added.
    // Return an explicit warning rather than hiding a broken historic link.
    const projects = await Project.find().sort({ createdAt: -1 });
    const warnings = [];
    for (let start = 0; start < projects.length; start += 10) {
      await Promise.all(projects.slice(start, start + 10).map(project => ensureProject(project._id).catch(err => {
        warnings.push({ projectId: String(project._id), message: err.message });
      })));
    }
    return warnings;
  }
  async function syncFromEnquiry(lead, edited) {
    if (!lead.studioProjectId) return;
    const project = await Project.findById(lead.studioProjectId);
    if (!project) throw fail("The linked project could not be found.");
    const values = {};
    if (Object.hasOwn(edited, "status")) values.status = lead.status === "Archived" ? "Archived" : project.status === "Completed" ? "Completed" : lead.status === "Converted" ? "Booked" : "Inquiry";
    for (const [source, target] of [["eventType", "type"], ["eventDate", "startDate"], ["eventLocation", "location"]])
      if (Object.hasOwn(edited, source)) values[target] = lead[source] || (source === "eventDate" ? null : "");
    if (Object.keys(values).length) await Project.updateOne({ _id: project._id }, { $set: values });
    const identity = {};
    for (const key of ["email", "phone"]) if (Object.hasOwn(edited, key)) identity[key] = lead[key];
    if (Object.hasOwn(edited, "name")) {
      const [firstName, ...last] = lead.name.trim().split(/\s+/);
      Object.assign(identity, { firstName, lastName: last.join(" ") });
    }
    if (Object.keys(identity).length) {
      await Contact.updateOne({ _id: project.contactId }, { $set: identity }, { runValidators: true });
      await syncContact(project.contactId);
    }
    await ensureProject(project._id);
  }
  return { ensureProject, syncQuote, syncContact, reconcile, syncFromEnquiry };
}
module.exports = { createPipeline, authoritativeQuote, stageFor,
  ...createPipeline({ Lead: require("../models/Lead"), Project: require("../models/StudioProject"), Contact: require("../models/StudioContact"), Quotation: require("../models/Quotation"), Event: require("../models/Event") }) };
