const crypto = require("crypto");
function expiryAt(value) {
  if (!value) return null;
  const date = new Date(value).toISOString().slice(0, 10);
  // Valid through the selected calendar day in the studio's Asia/Kolkata timezone.
  return new Date(Date.parse(date + "T18:30:00Z"));
}
function expired(quote, now = new Date()) {
  const end = expiryAt(quote.validUntil);
  return !end || now >= end;
}
function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function invoiceFromQuote(quote) {
  return {
    clientName: quote.clientName,
    invoiceDate: quote.acceptedAt,
    sourceQuotation: quote._id,
    sourceRevision: quote.revision,
    events: quote.items.map((i) => ({
      eventName: i.description,
      services: `Quantity: ${i.quantity}`,
      price: (i.quantity * i.unitPricePaise) / 100,
    })),
    deliverables: [],
    deliverablesPrice: 0,
    timeline: [],
    discount: quote.discountPaise / 100,
    extraCharges: quote.taxPaise / 100,
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
    items: q.items,
    discountPaise: q.discountPaise,
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
    expiresAt: expiryAt(q.validUntil),
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
