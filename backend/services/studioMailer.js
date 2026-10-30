const nodemailer = require("nodemailer");
const failure = (message, status = 503) =>
  Object.assign(new Error(message), { status });
const escapeHtml = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function mailerReady() {
  // Existing Team Alpha mailbox credentials are not a shared SaaS mail transport.
  if (require('../saas/tenantContext').currentWorkspace()) return false;
  return process.env.SMTP_HOST
    ? !!(
        (process.env.SMTP_USER || process.env.EMAIL_USER) &&
        (process.env.SMTP_PASS || process.env.EMAIL_PASS)
      )
    : !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
function frontendOrigin() {
  let parsed;
  try {
    parsed = new URL(process.env.FRONTEND_URL);
  } catch {
    throw failure(
      "Set FRONTEND_URL to the website address before sending quotations.",
    );
  }
  const octets = parsed.hostname.split(".");
  const privateIpv4 = octets.length === 4 && octets.every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255) &&
    (octets[0] === "10" || (octets[0] === "192" && octets[1] === "168") || (octets[0] === "172" && Number(octets[1]) >= 16 && Number(octets[1]) <= 31));
  const localPreview = process.env.STUDIO_LOCAL_PREVIEW === "true" && process.env.NODE_ENV !== "production" && privateIpv4;
  if (
    parsed.username ||
    parsed.password ||
    (parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        (["localhost", "127.0.0.1"].includes(parsed.hostname) || localPreview)
      ))
  )
    throw failure("FRONTEND_URL must use HTTPS.");
  return parsed.origin;
}
async function sendStudioMail({ to, subject, text, html, cc, messageId }) {
  if (!mailerReady())
    throw failure(
      "Email delivery is not configured. Configure SMTP or EMAIL_USER and EMAIL_PASS.",
    );
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const studio = await require('../models/StudioConfig').findOne({ key: 'studio' }) || {};
  const communication = studio.communication || {};
  const senderName = String(communication.senderName || studio.studioName || 'Team Alpha').replace(/[\r\n\x00-\x1f]/g, '').slice(0, 200);
  const senderAddress = /<([^<>]+)>/.exec(process.env.SMTP_FROM || '')?.[1] || process.env.SMTP_FROM || user;
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(communication.replyTo || '') ? communication.replyTo : undefined;
  const transport = nodemailer.createTransport(
    process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user, pass: process.env.SMTP_PASS || process.env.EMAIL_PASS },
          connectionTimeout: 15000,
          socketTimeout: 30000,
        }
      : {
          service: "gmail",
          auth: { user, pass: process.env.EMAIL_PASS },
          connectionTimeout: 15000,
          socketTimeout: 30000,
        },
  );
  try {
    const result = await transport.sendMail({
      from: { name: senderName, address: senderAddress },
      replyTo,
      to,
      cc,
      subject,
      text,
      html,
      messageId,
    });
    if (
      !result.accepted?.some(
        (address) => String(address).toLowerCase() === to.toLowerCase(),
      )
    )
      throw failure("The mail server did not accept the client recipient.");
    return { messageId: result.messageId, accepted: true };
  } finally {
    transport.close();
  }
}
module.exports = { mailerReady, frontendOrigin, sendStudioMail, escapeHtml };
