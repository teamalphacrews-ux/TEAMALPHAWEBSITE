const expirableStatuses = new Set(["Draft", "Sent", "Open"]);

/** Quotation validity ends at midnight IST after the selected calendar day. */
export function quotationExpiryTime(quote = {}) {
  if (quote.expiryEnabled === false) return null;
  const serverExpiry = quote.expiresAt ? new Date(quote.expiresAt).getTime() : NaN;
  if (Number.isFinite(serverExpiry)) return serverExpiry;
  if (!quote.validUntil) return null;
  const validUntil = new Date(quote.validUntil);
  if (!Number.isFinite(validUntil.getTime())) return null;
  return Date.parse(`${validUntil.toISOString().slice(0, 10)}T18:30:00Z`);
}

/** Lifecycle wording only. Email delivery states such as "sent" stay separate. */
export function quotationStatus(quote = {}, now = Date.now()) {
  const status = quote.status || "Draft";
  const expiry = quotationExpiryTime(quote);
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  if (expirableStatuses.has(status) && expiry !== null && timestamp >= expiry) return "Expired";
  return status === "Sent" ? "Open" : status;
}
