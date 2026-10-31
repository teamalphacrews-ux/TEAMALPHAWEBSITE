const crypto = require("crypto");
const Quotation = require("../models/Quotation");
const QuoteDelivery = require("../models/QuoteDelivery");
const StudioConfig = require("../models/StudioConfig");
const Notification = require("../models/Notification");
const { expired, tokenHash } = require("../utils/quoteLifecycle");
const mailer = require("./studioMailer");
const pipeline = require("./enquiryPipeline");
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function emailValues(body = {}, defaults = {}) {
  const subject =
    body.subject === undefined ? defaults.subject || "Your Team Alpha quotation" : body.subject;
  const message =
    body.message === undefined
      ? defaults.message || "Please review your quotation and accept it using the link below."
      : body.message;
  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.length > 200 ||
    /[\r\n\x00-\x1f]/.test(subject)
  )
    throw fail("Enter an email subject up to 200 characters.");
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 8000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(message)
  )
    throw fail("Enter an email message up to 8,000 characters.");
  if (body.sendCopy !== undefined && typeof body.sendCopy !== "boolean")
    throw fail("Invalid send-copy setting.");
  if (
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(body.idempotencyKey))
  )
    throw fail("Invalid email request identifier.");
  return {
    subject: subject.trim(),
    message: message.trim(),
    sendCopy: body.sendCopy === true,
  };
}
async function shareQuote(id, expectedRevision) {
  let quote = await Quotation.findById(id).select(
    "+shareToken +shareTokenHash",
  );
  if (!quote) throw fail("Quotation not found.", 404);
  if (expectedRevision !== undefined && quote.revision !== expectedRevision)
    throw fail("Quotation changed before delivery.", 409);
  if (!require('../utils/documentDefaults').linkIsActive(quote)) throw fail('This client link expired or was revoked. Regenerate it before sharing.', 409);
  if (!["Draft", "Sent"].includes(quote.status) || expired(quote))
    throw fail(
      "Use an open quotation with a future expiry date before sharing.",
    );
  if (quote.status === "Sent" && quote.shareToken && quote.shareTokenHash) {
    await pipeline.syncQuote(quote);
    return { token: quote.shareToken, quote };
  }
  const token = quote.shareToken || require("../saas/publicTokens").createShareToken();
  const options = require('../utils/documentDefaults').clientLinkOptions({}, quote.clientLinkOptions);
  const updated = await Quotation.findOneAndUpdate(
    {
      _id: quote._id,
      revision: quote.revision,
      status: quote.status,
      shareTokenHash: quote.shareTokenHash || { $exists: false },
    },
    {
      $set: {
        status: "Sent",
        shareToken: token,
        shareTokenHash: tokenHash(token),
        sharedAt: quote.sharedAt || new Date(),
        clientLinkOptions: options,
        ...(options.linkExpiryDays ? { linkExpiresAt: new Date(Date.now() + options.linkExpiryDays * 86400000) } : {}),
      },
      $unset: { linkRevokedAt: 1 },
      $push: {
        timeline: {
          kind: "shared",
          message: "Quotation finalized and shared with client.",
          at: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) {
    const current = await Quotation.findById(id).select(
      "+shareToken +shareTokenHash",
    );
    if (
      current?.revision === quote.revision &&
      current.status === "Sent" &&
      current.shareToken
    ) {
      await pipeline.syncQuote(current);
      return { token: current.shareToken, quote: current };
    }
    throw fail("This quotation changed. Refresh and try again.", 409);
  }
  await pipeline.syncQuote(updated);
  return { token, quote: updated };
}
function safeQuote(q) {
  const value = q.toObject ? q.toObject() : { ...q };
  delete value.shareToken;
  delete value.shareTokenHash;
  return value;
}
async function queueEmail(quote, body, scheduledFor) {
  if (!mailer.mailerReady())
    throw fail(
      "Studio email sending is not set up yet. Share the client link now, or finish outgoing email setup in Settings → Email & messages.",
      503,
    );
  mailer.frontendOrigin();
  if (!["Draft", "Sent"].includes(quote.status) || expired(quote))
    throw fail("Only open quotations can be sent.");
  const dueAt = scheduledFor ? new Date(scheduledFor) : new Date();
  if (
    !Number.isFinite(dueAt.getTime()) ||
    (scheduledFor &&
      (dueAt <= new Date() || dueAt > new Date(Date.now() + 365 * 86400000)))
  )
    throw fail("Schedule the email within the next 365 days.");
  if (scheduledFor && quote.expiryEnabled !== false && expired(quote, dueAt))
    throw fail("Schedule the email before the quotation expires.");
  const studio = body.subject === undefined || body.message === undefined ? await StudioConfig.findOne({ key: 'studio' }) || {} : {};
  const values = emailValues(body, require('../utils/documentDefaults').communicationValues(studio, 'quote', quote));
  const key = `${scheduledFor ? "scheduled" : "email"}:${quote._id}:${quote.revision}:${body.idempotencyKey || crypto.randomUUID()}`;
  const record = await QuoteDelivery.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        quotation: quote._id,
        revision: quote.revision,
        key,
        kind: "email",
        status: "queued",
        dueAt,
        recipient: quote.email,
        ...values,
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  return record;
}
async function queueConfirmation(quote) {
  if (!mailer.mailerReady()) return "unavailable";
  try {
    mailer.frontendOrigin();
    const key = `confirmation:${quote._id}:${quote.revision}`;
    const job = await QuoteDelivery.findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          key,
          quotation: quote._id,
          revision: quote.revision,
          kind: "confirmation",
          status: "queued",
          dueAt: new Date(),
          recipient: quote.email,
          subject: "Your quotation acceptance is confirmed",
          message:
            "Thank you for accepting your quotation. Your studio has received your acceptance.",
        },
      },
      { upsert: true, new: true },
    );
    return ["sent", "unknown", "failed"].includes(job.status)
      ? job.status
      : job.status === "cancelled"
        ? "failed"
        : "queued";
  } catch {
    return "failed";
  }
}
async function processDelivery(id) {
  const job = await QuoteDelivery.findOneAndUpdate(
    { _id: id, status: "queued", dueAt: { $lte: new Date() } },
    { $set: { status: "processing", startedAt: new Date() } },
    { new: true },
  );
  if (!job) return QuoteDelivery.findById(id);
  try {
    let quote = await Quotation.findById(job.quotation).select(
      "+shareToken +shareTokenHash",
    );
    const valid =
      quote &&
      require('../utils/documentDefaults').linkIsActive(quote) &&
      quote.revision === job.revision &&
      (job.kind === "confirmation"
        ? quote.status === "Accepted"
        : ["Draft", "Sent"].includes(quote.status) && !expired(quote));
    if (!valid)
      return QuoteDelivery.findByIdAndUpdate(
        job._id,
        {
          $set: {
            status: "cancelled",
            error: "Quotation was revised, closed or expired before delivery.",
          },
        },
        { new: true },
      );
    if (job.kind !== "confirmation")
      quote = (await shareQuote(quote._id, job.revision)).quote;
    const token =
      quote.shareToken ||
      (await Quotation.findById(quote._id).select("+shareToken")).shareToken;
    const link = `${mailer.frontendOrigin()}/quote/${token}`;
    const studio = await StudioConfig.findOne({ key: "studio" });
    const brand = studio?.studioName || "Team Alpha";
    const h = mailer.escapeHtml;
    const text = `${job.message}\n\n${brand}\n${quote.documentNumber || "Quotation"}\n${link}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px"><h2>${h(brand)}</h2><p style="white-space:pre-wrap">${h(job.message)}</p><p><strong>${h(quote.documentNumber || "Quotation")}</strong></p><p><a href="${h(link)}">${job.kind === "confirmation" ? "View accepted quotation" : "Review quotation"}</a></p></div>`;
    const result = await mailer.sendStudioMail({
      to: quote.email,
      subject: job.subject,
      text,
      html,
      cc: job.sendCopy
        ? studio?.email || process.env.SMTP_USER || process.env.EMAIL_USER
        : undefined,
      messageId: `<quote-${job._id}@teamalpha.local>`,
    });
    const saved = await QuoteDelivery.findByIdAndUpdate(
      job._id,
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
          messageId: result.messageId,
          error: "",
        },
      },
      { new: true },
    );
    await Quotation.findByIdAndUpdate(quote._id, {
      $push: {
        timeline: {
          kind: job.kind === "confirmation" ? "confirmation" : "email",
          message:
            job.kind === "reminder"
              ? "Quotation reminder email accepted by the mail server."
              : job.kind === "confirmation"
                ? "Acceptance confirmation email accepted by the mail server."
                : "Quotation email accepted by the mail server.",
          at: new Date(),
        },
      },
      ...(job.kind === "confirmation"
        ? { $set: { emailConfirmationStatus: "sent" } }
        : {}),
    });
    return saved;
  } catch (error) {
    // SMTP cannot guarantee whether an interrupted request was delivered. Do not
    // retry automatically; the owner can review history and explicitly resend.
    const saved = await QuoteDelivery.findByIdAndUpdate(
      job._id,
      {
        $set: {
          status: "unknown",
          error: error.status
            ? error.message
            : "Delivery could not be confirmed. Review your mail provider before resending.",
        },
      },
      { new: true },
    );
    if (job.kind === "confirmation")
      await Quotation.findByIdAndUpdate(job.quotation, {
        $set: { emailConfirmationStatus: "unknown" },
      });
    return saved;
  }
}
let running = false;
async function runQuoteDeliveryJobs() {
  if (running) return;
  running = true;
  try {
    await QuoteDelivery.updateMany(
      {
        status: "processing",
        startedAt: { $lt: new Date(Date.now() - 5 * 60000) },
      },
      {
        $set: {
          status: "unknown",
          error:
            "Worker interrupted. Review delivery with the provider before resending.",
        },
      },
    );
    const quotes = await Quotation.find({
      status: "Sent",
      sharedAt: { $exists: true },
    }).limit(250);
    for (const quote of quotes) {
      if (expired(quote)) {
        const claimed = await Quotation.findOneAndUpdate(
          {
            _id: quote._id,
            expiredNotifiedAt: { $exists: false },
            status: "Sent",
          },
          {
            $set: { expiredNotifiedAt: new Date() },
            $push: {
              timeline: {
                kind: "expired",
                message: "Quotation expired.",
                at: new Date(),
              },
            },
          },
        );
        if (claimed)
          await Notification.create({
            title: "Quotation expired",
            description: `${quote.clientName}'s quotation has expired.`,
            type: "System",
            link: "/admin/quotations",
          });
        continue;
      }
      if (!require('../utils/documentDefaults').linkIsActive(quote) || !mailer.mailerReady() || !quote.remindersEnabled) continue;
      // After downtime or a newly configured mailer, send the latest due reminder
      // once rather than delivering every missed reminder in a burst.
      const day = (quote.reminderDays || [])
        .filter(
          (d) =>
            new Date(new Date(quote.sharedAt).getTime() + d * 86400000) <=
            new Date(),
        )
        .sort((a, b) => b - a)[0];
      if (day !== undefined) {
        const dueAt = new Date(
          new Date(quote.sharedAt).getTime() + day * 86400000,
        );
        if (expired(quote, dueAt)) continue;
        await QuoteDelivery.updateMany(
          {
            quotation: quote._id,
            revision: quote.revision,
            kind: "reminder",
            status: "queued",
            dueAt: { $lt: dueAt },
          },
          {
            $set: {
              status: "cancelled",
              error: "A newer reminder superseded this missed reminder.",
            },
          },
        );
        const key = `reminder:${quote._id}:${quote.revision}:${day}`;
        await QuoteDelivery.updateOne(
          { key },
          {
            $setOnInsert: {
              key,
              quotation: quote._id,
              revision: quote.revision,
              kind: "reminder",
              status: "queued",
              dueAt,
              recipient: quote.email,
              subject: "A reminder to review your quotation",
              message: `Hi ${quote.clientName}, please review your quotation and accept it before the expiry date.`,
            },
          },
          { upsert: true },
        );
      }
    }
    if (mailer.mailerReady()) {
      const jobs = await QuoteDelivery.find({
        status: "queued",
        dueAt: { $lte: new Date() },
      })
        .sort({ dueAt: 1 })
        .limit(25);
      for (const job of jobs) await processDelivery(job._id);
    }
  } finally {
    running = false;
  }
}
function startQuoteWorker() {
  const tick = () =>
    require('../saas/workers').forEachWorkspace(() => runQuoteDeliveryJobs()).catch(() =>
      console.error("Quotation delivery worker is temporarily unavailable."),
    );
  tick();
  const timer = setInterval(tick, 60000);
  timer.unref();
  return () => clearInterval(timer);
}
module.exports = {
  emailValues,
  shareQuote,
  safeQuote,
  queueEmail,
  queueConfirmation,
  processDelivery,
  runQuoteDeliveryJobs,
  startQuoteWorker,
};
