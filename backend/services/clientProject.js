const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const StudioConfig = require("../models/StudioConfig");
const ProjectMessage = require("../models/ProjectMessage");
const { tokenHash } = require("../utils/quoteLifecycle");
const { publicInvoice } = require("../routes/publicInvoiceRoutes");
const { deliveryUrl } = require("../utils/productionTask");
const { clientLinkOptions, linkIsActive } = require('../utils/documentDefaults');
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
async function acceptedQuote(token) {
  if (!require('../saas/publicTokens').isShareToken(token))
    fail(404, "This project link is unavailable.");
  const quote = await Quotation.findOne({
    shareTokenHash: tokenHash(token),
    status: "Accepted",
  });
  if (!quote || !linkIsActive(quote))
    fail(404, "This project link is unavailable. Please contact the studio.");
  return quote;
}
function publicTask(task, visibility = clientLinkOptions()) {
  let url = "";
  if (
    [
      "Ready",
      "Uploaded to Drive",
      "Delivered",
      "Awaiting your selection",
    ].includes(task.productionStage)
  ) {
    try {
      url = deliveryUrl(task.deliveryUrl);
    } catch {
      /* old unsafe URLs stay private */
    }
  }
  return {
    id: task._id,
    title: task.clientTitle || task.deliveryType || "Project delivery",
    type: task.deliveryType || "Other",
    ...(visibility.showProgress ? { stage: task.productionStage || "Not started", update: task.clientUpdate || "", dueDate: task.dueDate || null, updatedAt: task.updatedAt } : {}),
    url: visibility.showDeliverables ? url : '',
    crew: visibility.showCrew && task.assignee?.name
      ? {
          name: task.assignee.name,
          role: task.assignee.specialty || "Studio team",
        }
      : null,
  };
}
async function projectView(quote) {
  const visibility = clientLinkOptions({}, quote.clientLinkOptions);
  const invoice = quote.invoiceId
    ? await Invoice.findOne({
        _id: quote.invoiceId,
        sourceQuotation: quote._id,
      })
    : null;
  const approved =
    invoice?.documentStatus === "Sent" && invoice.status !== "Cancelled";
  const studio = approved ? await StudioConfig.findOne({ key: 'studio' }) || {} : {};
  const invoiceView = !visibility.showPayments ? { state: 'hidden' } : !invoice
    ? { state: "preparing" }
    : invoice.documentStatus === "Cancelled" || invoice.status === "Cancelled"
      ? { state: "cancelled", number: invoice.documentNumber }
      : approved
        ? {
            state: "issued",
            document: publicInvoice(
              invoice,
              studio,
            ),
          }
        : {
            state: "awaiting_approval",
            number: invoice.documentNumber,
            quotedTotal: Number(quote.totalPaise || 0) / 100,
          };
  let deliveries = [];
  if (approved) {
    const lead = quote.lead
      ? await Lead.findById(quote.lead)
      : quote.studioProjectId
        ? await Lead.findOne({ studioProjectId: quote.studioProjectId })
        : null;
    const matchesProject =
      lead &&
      (!quote.studioProjectId ||
        String(lead.studioProjectId) === String(quote.studioProjectId));
    if (matchesProject)
      deliveries = (
        await Task.find({ lead: lead._id, clientVisible: true })
          .populate("assignee", "name specialty")
          .sort({ dueDate: 1, createdAt: 1 })
      )
        .filter(
          (task) =>
            task.clientVisible === true &&
            String(task.lead?._id || task.lead) === String(lead._id),
        )
        .map(task => publicTask(task, visibility));
  }
  const crew = [...new Map(deliveries.filter(task => task.crew).map(task => [task.crew.name + task.crew.role, task.crew])).values()];
  const started = deliveries.some((task) => task.stage && task.stage !== "Not started");
  const order = [
    "Photos",
    "Album",
    "Traditional video",
    "Cinematic video",
    "Other",
  ];
  deliveries.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return {
    visibility,
    supportHours: studio.communication?.supportHours || '',
    crew: visibility.showCrew && (started || deliveries.some(task => task.url)) ? crew : [],
    invoice: invoiceView,
    production: {
      state: !visibility.showProgress ? (visibility.showDeliverables ? 'deliveries_only' : 'hidden') : !approved
        ? "awaiting_invoice"
        : !started
          ? "not_started"
          : deliveries.every((task) =>
                ["Delivered", "Uploaded to Drive"].includes(task.stage),
              )
            ? "delivered"
            : "in_progress",
      deliveries: !visibility.showProgress ? (visibility.showDeliverables ? deliveries.filter(task => task.url) : []) : started ? deliveries : [],
    },
  };
}
async function assertClientChat(quote) {
  if (!clientLinkOptions({}, quote.clientLinkOptions).allowChat) fail(403, 'Chat support is not enabled for this project link. Please contact the studio directly.');
}
function messageValues(body) {
  if (
    !body ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.trim().length > 2000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body.text)
  )
    fail(400, "Enter a message of 1–2,000 characters.");
  if (
    typeof body.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{8,120}$/.test(body.requestId)
  )
    fail(400, "A message request ID is required.");
  return { text: body.text.trim(), requestId: body.requestId };
}
const publicMessage = (message) => ({
  _id: message._id,
  text: message.text,
  author: message.author,
  createdAt: message.createdAt,
});
async function messages(quoteId, before) {
  if (before && !/^[a-f\d]{24}$/i.test(before))
    fail(400, "Invalid message cursor.");
  const result = await ProjectMessage.find({
    quotation: quoteId,
    ...(before ? { _id: { $lt: before } } : {}),
  })
    .sort({ _id: -1 })
    .limit(100);
  return {
    messages: result.map(publicMessage).reverse(),
    nextCursor:
      result.length === 100 ? String(result[result.length - 1]._id) : null,
  };
}
async function saveMessage(quote, author, body) {
  if (author === 'client') await assertClientChat(quote);
  const values = messageValues(body);
  const key = { quotation: quote._id, author, requestId: values.requestId };
  const existing = await ProjectMessage.findOne(key);
  if (existing) return publicMessage(existing);
  const recent = await ProjectMessage.countDocuments({
    quotation: quote._id,
    author,
    createdAt: { $gte: new Date(Date.now() - 60000) },
  });
  if (recent >= 20)
    fail(429, "Please wait a minute before sending more messages.");
  let message;
  try {
    message = await ProjectMessage.create({
      ...key,
      text: values.text,
      studioRead: author === "studio",
    });
  } catch (error) {
    if (error.code === 11000)
      return publicMessage(await ProjectMessage.findOne(key));
    throw error;
  }
  if (author === "client")
    await require("../models/Notification")
      .create({
        title: "Client support message",
        description: `${quote.clientName} sent a project message.`,
        type: "System",
        link: "/admin/chats",
      })
      .catch(() => {});
  return publicMessage(message);
}
module.exports = {
  acceptedQuote,
  projectView,
  publicTask,
  messageValues,
  publicMessage,
  messages,
  saveMessage,
  assertClientChat,
};
