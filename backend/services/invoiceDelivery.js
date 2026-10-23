const crypto = require("crypto");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const { tokenHash } = require("../utils/quoteLifecycle");
const {
  mailerReady,
  frontendOrigin,
  sendStudioMail,
  escapeHtml,
} = require("./studioMailer");
const number = (i) =>
  i.documentNumber || `INV-${String(i._id).slice(-8).toUpperCase()}`;
async function shareInvoice(invoice, { markSent = true } = {}) {
  const origin = frontendOrigin();
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await Invoice.findById(invoice._id).select(
      "+shareToken +shareTokenHash",
    );
    if (
      !current ||
      current.status === "Cancelled" ||
      current.documentStatus === "Cancelled"
    )
      throw Object.assign(
        new Error("Cancelled or unavailable invoices cannot be shared"),
        { status: 409 },
      );
    if (current.shareToken && current.shareTokenHash) {
      if (markSent) {
        const update = await Invoice.updateOne(
          {
            _id: current._id,
            shareTokenHash: current.shareTokenHash,
            status: { $ne: "Cancelled" },
            documentStatus: { $ne: "Cancelled" },
          },
          { $set: { documentStatus: "Sent" } },
        );
        if (!update.matchedCount) continue;
      }
      return `${origin}/invoice/${current.shareToken}`;
    }
    const token = crypto.randomBytes(32).toString("hex");
    const update = await Invoice.updateOne(
      {
        _id: current._id,
        shareTokenHash: { $exists: false },
        status: { $ne: "Cancelled" },
        documentStatus: { $ne: "Cancelled" },
      },
      {
        $set: {
          shareToken: token,
          shareTokenHash: tokenHash(token),
          sharedAt: current.sharedAt || new Date(),
          ...(markSent ? { documentStatus: "Sent" } : {}),
        },
      },
    );
    if (update.matchedCount) return `${origin}/invoice/${token}`;
  }
  throw Object.assign(new Error("Invoice sharing changed. Please retry."), {
    status: 409,
  });
}
async function sendInvoiceEmail(invoice, options = {}) {
  if (!mailerReady())
    throw Object.assign(
      new Error(
        "Email is not configured. Connect the studio email service or share the invoice link.",
      ),
      { status: 503 },
    );
  if (!invoice.clientEmail)
    throw Object.assign(new Error("Add a client email before sending"), {
      status: 400,
    });
  const subjectInput = options.subject;
  if (
    subjectInput != null &&
    (typeof subjectInput !== "string" ||
      subjectInput.length > 200 ||
      /[\x00-\x1f\x7f]/.test(subjectInput))
  )
    throw Object.assign(
      new Error("Use a subject without line breaks and up to 200 characters"),
      { status: 400 },
    );
  if (
    options.message != null &&
    (typeof options.message !== "string" || options.message.length > 12000)
  )
    throw Object.assign(new Error("Message must be up to 12000 characters"), {
      status: 400,
    });
  const key = options.requestId;
  if (key && (typeof key !== "string" || !/^[a-zA-Z0-9:_-]{8,120}$/.test(key)))
    throw Object.assign(new Error("Invalid delivery request"), { status: 400 });
  const studio = await StudioConfig.findOne({ key: "studio" });
  const url = await shareInvoice(invoice, { markSent: false });
  const subject = String(
    options.subject ||
      `Invoice ${number(invoice)} from ${studio?.studioName || "Team Alpha"}`,
  )
    .trim()
    .slice(0, 200);
  const message = String(
    options.message ||
      `Hi ${invoice.clientName},\n\nPlease review your invoice for INR ${invoice.total.toFixed(2)} due on ${new Date(invoice.dueDate || invoice.invoiceDate).toISOString().slice(0, 10)}.\n\nThank you,\n${studio?.studioName || "Team Alpha"}`,
  ).slice(0, 12000);
  const delivery = {
    to: invoice.clientEmail,
    subject,
    text: `${message}\n\nView invoice: ${url}`,
    html: `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p><p><a href="${escapeHtml(url)}">View invoice</a></p>`,
  };
  if (options.sendCopy && studio?.email) delivery.cc = studio.email;
  if (key) {
    const claim = await Invoice.updateOne(
      {
        _id: invoice._id,
        status: { $ne: "Cancelled" },
        documentStatus: { $ne: "Cancelled" },
        deliveryRequests: { $not: { $elemMatch: { key } } },
      },
      {
        $push: { deliveryRequests: { key, state: "sending", at: new Date() } },
      },
    );
    if (!claim.modifiedCount) {
      const previous = await Invoice.findById(invoice._id);
      if (
        previous?.deliveryRequests?.some(
          (r) => r.key === key && r.state === "sent",
        )
      )
        return { url, message: "This invoice email was already sent" };
      throw Object.assign(
        new Error(
          "This email request is already processing or needs delivery review. Check history before retrying.",
        ),
        { status: 409 },
      );
    }
  }
  try {
    await sendStudioMail(delivery);
  } catch (err) {
    if (key)
      await Invoice.updateOne(
        { _id: invoice._id, "deliveryRequests.key": key },
        { $set: { "deliveryRequests.$.state": "unknown" } },
      );
    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $push: {
          deliveries: {
            $each: [
              {
                sentAt: new Date(),
                channel: "email",
                state: "unknown",
                error:
                  "Email delivery could not be confirmed. Check the recipient before retrying.",
              },
            ],
            $slice: -50,
          },
        },
      },
    );
    throw Object.assign(
      new Error(
        "Email delivery could not be confirmed. Check delivery history and the recipient before retrying.",
      ),
      { status: 503 },
    );
  }
  if (key)
    await Invoice.updateOne(
      { _id: invoice._id, "deliveryRequests.key": key },
      { $set: { "deliveryRequests.$.state": "sent" } },
    );
  await Invoice.updateOne(
    {
      _id: invoice._id,
      status: { $ne: "Cancelled" },
      documentStatus: { $ne: "Cancelled" },
    },
    {
      $set: { documentStatus: "Sent" },
      $push: {
        deliveries: {
          $each: [
            {
              sentAt: new Date(),
              channel: options.channel || "email",
              subject,
              state: "sent",
            },
          ],
          $slice: -50,
        },
      },
    },
  );
  return { url, message: "Invoice email sent" };
}
async function runInvoiceDeliveryJobs() {
  const now = new Date();
  await Invoice.updateMany(
    {
      "scheduledDelivery.state": "sending",
      "scheduledDelivery.claimAt": {
        $lt: new Date(now.getTime() - 10 * 60000),
      },
    },
    {
      $set: {
        "scheduledDelivery.state": "unknown",
        "scheduledDelivery.error":
          "Delivery was interrupted and cannot be confirmed. Review with the recipient before sending again.",
      },
    },
  );
  if (!mailerReady()) return;
  const scheduled = await Invoice.find({
    "scheduledDelivery.state": "scheduled",
    "scheduledDelivery.at": { $lte: now },
    status: { $ne: "Cancelled" },
    documentStatus: { $ne: "Cancelled" },
  })
    .select("+shareToken")
    .limit(25);
  for (const invoice of scheduled) {
    const claim = await Invoice.updateOne(
      { _id: invoice._id, "scheduledDelivery.state": "scheduled" },
      {
        $set: {
          "scheduledDelivery.state": "sending",
          "scheduledDelivery.claimAt": now,
        },
      },
    );
    if (!claim.modifiedCount) continue;
    try {
      await sendInvoiceEmail(invoice, {
        ...(invoice.scheduledDelivery.toObject?.() ||
          invoice.scheduledDelivery),
        requestId: `schedule:${new Date(invoice.scheduledDelivery.at).getTime()}`,
      });
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "scheduledDelivery.state": "sent",
            "scheduledDelivery.error": "",
          },
        },
      );
    } catch (e) {
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "scheduledDelivery.state": "failed",
            "scheduledDelivery.error":
              e.status === 503
                ? e.message
                : "Delivery failed. Review and retry manually.",
          },
        },
      );
    }
  }
  // A persisted daily marker prevents repeat sends while the process ticks every minute.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const invoices = await Invoice.find({
    paymentReminders: true,
    documentStatus: "Sent",
    status: "Pending",
    clientEmail: { $ne: "" },
  })
    .select("+shareToken")
    .limit(200);
  for (const invoice of invoices) {
    const payments = invoice.paymentScheduleEnabled
      ? invoice.paymentSchedule
      : [
          {
            amountPaise: Math.round(invoice.total * 100),
            dueDate: invoice.dueDate,
          },
        ];
    let remainingCredit = invoice.advancePaid * 100;
    for (let index = 0; index < payments.length; index++) {
      const payment = payments[index];
      const owed = Math.max(0, payment.amountPaise - remainingCredit);
      remainingCredit = Math.max(0, remainingCredit - payment.amountPaise);
      if (!owed || !payment.dueDate) continue;
      const diff = Math.round(
        (Date.parse(today) -
          Date.parse(new Date(payment.dueDate).toISOString().slice(0, 10))) /
          86400000,
      );
      if (!(invoice.reminderOffsets || []).includes(diff)) continue;
      const key = `${index}:${today}`;
      const claim = await Invoice.updateOne(
        { _id: invoice._id, reminderLog: { $ne: key }, status: "Pending" },
        { $push: { reminderLog: key } },
      );
      if (!claim.modifiedCount) continue;
      try {
        await sendInvoiceEmail(invoice, {
          subject: `Payment reminder: ${number(invoice)}`,
          message: `Hi ${invoice.clientName},\n\nYour payment of INR ${(owed / 100).toFixed(2)} is due on ${new Date(payment.dueDate).toISOString().slice(0, 10)}. Please review your invoice for the studio payment instructions.`,
          channel: "reminder",
          requestId: `reminder:${key}`,
        });
      } catch {
        await Invoice.updateOne(
          { _id: invoice._id },
          {
            $push: {
              deliveries: {
                $each: [
                  {
                    sentAt: now,
                    channel: "reminder",
                    state: "failed",
                    error:
                      "Reminder delivery failed; contact the client manually.",
                  },
                ],
                $slice: -50,
              },
            },
          },
        );
      }
    }
  }
}
module.exports = {
  shareInvoice,
  sendInvoiceEmail,
  runInvoiceDeliveryJobs,
  invoiceNumber: number,
};
