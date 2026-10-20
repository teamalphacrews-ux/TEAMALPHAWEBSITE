const crypto = require("crypto");
function expiryAt(value) {
  if (!value) return null;
  const date = new Date(value).toISOString().slice(0, 10);
  // Valid through the selected calendar day in the studio's Asia/Kolkata timezone.
  return new Date(Date.parse(date + "T18:30:00Z"));
}
function expired(quote, now = new Date()) {
  if (quote.expiryEnabled === false) return false;
  const end = expiryAt(quote.validUntil);
  return !end || now >= end;
}
function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function invoiceFromQuote(quote) {
  return {
    title: quote.title || "",
    leadId: quote.lead || null,
    clientEmail: quote.email,
    clientPhone: quote.clientPhone || "",
    contactId: quote.contactId || null,
    studioProjectId: quote.studioProjectId || null,
    sourceQuoteNumber: quote.documentNumber || "",
    documentStatus: "Draft",
    documentNumber: `INV-${String(quote.invoiceId || quote._id).slice(-8).toUpperCase()}`,
    dueDate: new Date(new Date(quote.acceptedAt).getTime() + 30 * 86400000),
    items: quote.items.map((i) => ({
      title: i.title || "",
      description: i.description || "",
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
    })),
    discountType: quote.discountType === "percent" ? "percent" : "fixed",
    discountValue: quote.discountValue ?? quote.discountPaise / 100,
    notes: quote.notes || "",
    design: {
      coverUrl: quote.design?.coverImage || "",
      accentColor: quote.design?.colorTheme || "#1f2427",
      fontFamily: quote.design?.fontTheme || "modern",
      showLogo: true,
    },
    clientName: quote.clientName,
    invoiceDate: quote.acceptedAt,
    sourceQuotation: quote._id,
    sourceRevision: quote.revision,
    events: quote.items.map((i) => ({
      eventName: i.title || i.description,
      services: `Quantity: ${i.quantity}`,
      price: (i.quantity * i.unitPricePaise) / 100,
    })),
    deliverables: [],
    deliverablesPrice: 0,
    timeline: [],
    discount: quote.discountPaise / 100,
    extraCharges: 0,
    taxRateBps: quote.taxRateBps,
    taxAmount: quote.taxPaise / 100,
    terms: quote.terms,
    total: quote.totalPaise / 100,
    advancePaid: 0,
    status: "Pending",
  };
}
function publicQuote(q, studio) {
  return {
    _id: q._id,
    clientName: q.clientName,
    title: q.title,
    documentNumber:
      q.documentNumber ||
      `${studio?.invoicePrefix || "TA"}-Q-${String(q._id).slice(-6).toUpperCase()}`,
    issueDate: q.issueDate || q.createdAt,
    notes: q.notes || "",
    design: q.design || {},
    expiryEnabled: q.expiryEnabled !== false,
    autoCreateInvoice: q.autoCreateInvoice !== false,
    emailConfirmationStatus: q.emailConfirmationStatus || "none",
    timeline: (q.timeline || [])
      .filter((t) => ["created", "shared", "accepted"].includes(t.kind))
      .map((t) => ({ kind: t.kind, message: t.message, at: t.at })),
    items: q.items,
    discountPaise: q.discountPaise,
    discountType: q.discountType || "amount",
    discountValue: q.discountValue ?? q.discountPaise / 100,
    subtotalPaise: q.subtotalPaise,
    taxRateBps: q.taxRateBps,
    taxPaise: q.taxPaise,
    totalPaise: q.totalPaise,
    terms: q.terms,
    revision: q.revision,
    createdAt: q.createdAt,
    sharedAt: q.sharedAt,
    acceptedAt: q.acceptedAt,
    acceptedBy: q.acceptedBy,
    validUntil: q.validUntil,
    expiresAt: q.expiryEnabled === false ? null : expiryAt(q.validUntil),
    status:
      q.status === "Accepted" ? "Accepted" : expired(q) ? "Expired" : q.status,
    invoiceReady: !!q.invoiceGeneratedAt,
    studio: {
      name: studio?.studioName || "Team Alpha",
      email: studio?.email || "",
      phone: studio?.phone || "",
      prefix: studio?.invoicePrefix || "TA",
    },
  };
}
module.exports = {
  expiryAt,
  expired,
  tokenHash,
  invoiceFromQuote,
  publicQuote,
};
