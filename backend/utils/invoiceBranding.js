const fields = ["name", "address", "email", "phone", "website", "taxId", "logoUrl", "paymentInstructions", "bankDetails", "upiId"];
function invoiceIssuer(studio = {}, custom = {}) {
  return {
    name: studio.legalName || studio.studioName || "Team Alpha",
    address: studio.address || "",
    email: studio.email || "",
    phone: studio.phone || "",
    website: studio.website || "",
    taxId: studio.gstin || studio.taxId || "",
    logoUrl: publicBrandImage(studio.logoUrl || "/assets/team-alpha-logo-20261021.png"),
    paymentInstructions: studio.paymentInstructions || "",
    bankDetails: studio.bankDetails || "",
    upiId: studio.upiId || "",
    ...Object.fromEntries(fields.filter(key => typeof custom[key] === "string").map(key => [key, key === "logoUrl" ? publicBrandImage(custom[key]) : custom[key]])),
  };
}
function validImage(url) {
  if (typeof url !== "string" || url.length > 2000) return false;
  if (/^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(url)) return true;
  if (url === "/team-alpha-logo.png" || (/^\/assets\/[\w./-]+$/.test(url) && !url.includes(".."))) return true;
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
function publicBrandImage(url) {
  if (!/^\/api\/studio\/profile-images\/[a-f\d]{24}$/i.test(url || "")) return url;
  try {
    const origin = new URL(process.env.API_PUBLIC_URL || process.env.GOOGLE_REDIRECT_URI).origin;
    if (origin.startsWith("https://") || (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin))) return origin + url;
  } catch { /* The frontend safely resolves a relative API image when no public origin is configured. */ }
  return url;
}
function issuerValues(value) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Enter valid business details");
  const result = Object.fromEntries(fields.map(key => [key, typeof value[key] === "string" ? value[key].trim().slice(0, ["address", "paymentInstructions", "bankDetails"].includes(key) ? 4000 : 2000) : ""]));
  if (!result.name) fail("Business name is required");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail("Enter a valid business email");
  if (result.logoUrl && !validImage(result.logoUrl)) fail("Logo must use an HTTPS image URL or a studio asset");
  if (result.website) {
    try { const u = new URL(result.website); if (u.protocol !== "https:" || u.username || u.password) fail("Use an HTTPS business website"); } catch { fail("Use an HTTPS business website"); }
  }
  return result;
}
module.exports = { invoiceIssuer, issuerValues, validImage, publicBrandImage };
