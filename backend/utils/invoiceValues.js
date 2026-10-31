const { issuerValues } = require("./invoiceBranding");
const objectId = /^[a-f\d]{24}$/i;
function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
function text(v, limit = 4000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, limit);
}
function money(v, label) {
  const n = Number(v ?? 0);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 1e10 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.0001
  )
    fail(label + " must be a non-negative amount with up to two decimals");
  return Math.round(n * 100);
}
function date(v, label) {
  if (!v || !Number.isFinite(Date.parse(v))) fail(label + " is required");
  const d = new Date(v);
  const day = d.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && day !== v)
    fail("Invalid " + label.toLowerCase());
  return new Date(day + "T00:00:00Z");
}
function safeCover(v) {
  if (!v) return "/assets/studio-wedding.webp";
  if (typeof v !== "string" || v.length > 2000) fail("Invalid cover image");
  if (/^\/assets\/[\w./-]+$/.test(v) && !v.includes("..")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && !u.username && !u.password) return u.href;
  } catch {
    /* invalid */
  }
  fail("Cover image must use an HTTPS URL or a studio asset");
}
function invoiceValues(body, existing = {}) {
  const input = { ...existing, ...body };
  if (!text(input.clientName, 120)) fail("Client name is required");
  const invoiceDate = date(input.invoiceDate, "Invoice date");
  const dueDate = input.dueDate
    ? date(input.dueDate, "Due date")
    : new Date(invoiceDate.getTime() + 30 * 86400000);
  if (dueDate < invoiceDate) fail("Due date cannot be before the invoice date");
  const canonical = Array.isArray(input.items) && input.items.length > 0;
  let subtotal = 0;
  const items = canonical
    ? input.items.map((i) => {
        if (
          !Number.isSafeInteger(Number(i.quantity)) ||
          Number(i.quantity) < 1 ||
          Number(i.quantity) > 1000
        )
          fail("Item quantity must be a whole number from 1 to 1000");
        if (
          !Number.isSafeInteger(Number(i.unitPricePaise)) ||
          Number(i.unitPricePaise) < 0 ||
          Number(i.unitPricePaise) > 1e12
        )
          fail("Invalid item price");
        if (!text(i.title || i.description))
          fail("Each item needs a title or description");
        const item = {
          title: text(i.title, 300),
          description: text(i.description, 8000),
          quantity: Number(i.quantity),
          unitPricePaise: Number(i.unitPricePaise),
        };
        subtotal += item.quantity * item.unitPricePaise;
        return item;
      })
    : [];
  if (items.length > 40) fail("Use up to 40 invoice items");
  if (!Array.isArray(input.events || []) || (input.events || []).length > 40)
    fail("Use up to 40 invoice items");
  const events = (input.events || []).map((e) => ({
    eventName: text(e.eventName),
    services: text(e.services),
    equipment: text(e.equipment, 1000),
    dateLocation: text(e.dateLocation, 1000),
    price: money(e.price, "Item price") / 100,
  }));
  const deliverablesPrice = canonical
    ? 0
    : money(input.deliverablesPrice, "Deliverables");
  if (!canonical)
    subtotal =
      events.reduce((s, e) => s + Math.round(e.price * 100), 0) +
      deliverablesPrice;
  if (!Number.isSafeInteger(subtotal) || subtotal > 1e12)
    fail("Invoice subtotal is too large");
  const discountType = input.discountType || "fixed";
  if (!["fixed", "percent"].includes(discountType))
    fail("Invalid discount type");
  let discountValue = input.discountValue;
  if (Object.hasOwn(body, "discount") && !Object.hasOwn(body, "discountValue"))
    discountValue = body.discount;
  if (discountValue == null) discountValue = input.discount || 0;
  if (
    discountType === "percent" &&
    (Number(discountValue) > 100 || Number(discountValue) < 0)
  )
    fail("Discount percent must be between 0 and 100");
  const fixed = money(discountValue, "Discount");
  const discount =
    discountType === "percent" ? Math.round((subtotal * fixed) / 10000) : fixed;
  if (discount > subtotal) fail("Discount cannot exceed the subtotal");
  const taxRateBps = Number(input.taxRateBps || 0);
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000)
    fail("Tax rate must be from 0 to 100 percent");
  const migratingQuoteInvoice =
    canonical &&
    !existing.items?.length &&
    existing.sourceQuotation &&
    existing.taxAmount &&
    !Object.hasOwn(body, "extraCharges");
  const extraCharges = money(
    migratingQuoteInvoice
      ? Math.max(
          0,
          Number(input.extraCharges || 0) - Number(existing.taxAmount || 0),
        )
      : input.extraCharges,
    "Extra charges",
  );
  // Legacy quotation invoices stored their tax in extraCharges; canonical items calculate tax separately.
  const taxAmount = canonical
    ? Math.round(((subtotal - discount) * taxRateBps) / 10000)
    : 0;
  const total = subtotal - discount + extraCharges + taxAmount;
  const advancePaid = money(input.advancePaid, "Advance");
  if (advancePaid > total) fail("Payments cannot exceed the total");
  const status = input.status || "Pending";
  if (!["Pending", "Paid", "Cancelled"].includes(status))
    fail("Invalid invoice status");
  const documentStatus = input.documentStatus || "Draft";
  if (!["Draft", "Sent", "Cancelled"].includes(documentStatus))
    fail("Invalid document status");
  const email = text(input.clientEmail, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Enter a valid client email");
  const result = {
    clientName: text(input.clientName, 120),
    clientEmail: email,
    clientPhone: text(input.clientPhone, 40),
    clientAddress: text(input.clientAddress, 4000),
    title: text(input.title, 300),
    invoiceDate,
    dueDate,
    documentNumber: text(input.documentNumber, 60),
    documentStatus,
    items,
    events,
    deliverables: Array.isArray(input.deliverables)
      ? input.deliverables.slice(0, 50).map((x) => text(x, 1000))
      : [],
    timeline: Array.isArray(input.timeline)
      ? input.timeline.slice(0, 50).map((x) => ({
          deliverable: text(x.deliverable, 1000),
          time: text(x.time, 1000),
        }))
      : [],
    deliverablesPrice: deliverablesPrice / 100,
    discountType,
    discountValue: Number(discountValue),
    discount: discount / 100,
    taxRateBps,
    taxAmount: taxAmount / 100,
    extraCharges: extraCharges / 100,
    advancePaid: advancePaid / 100,
    total: total / 100,
    status,
    notes: text(input.notes, 12000),
    terms: text(input.terms, 12000),
    currency: "INR",
    paymentScheduleEnabled: input.paymentScheduleEnabled === true,
    paymentReminders: input.paymentReminders === true,
    allowTip: input.allowTip === true,
  };
  if (input.currency && input.currency !== "INR")
    fail("Invoices currently support INR");
  if (input.issuer != null) result.issuer = issuerValues(input.issuer);
  for (const key of ["contactId", "studioProjectId", "leadId"]) {
    if (input[key]) {
      if (!objectId.test(String(input[key]))) fail("Invalid linked record");
      result[key] = input[key];
    } else result[key] = null;
  }
  const methods = input.acceptedPaymentMethods || ["BANKING", "G-pay", "UPI"];
  if (
    !Array.isArray(methods) ||
    methods.some((x) => !["BANKING", "G-pay", "UPI"].includes(x))
  )
    fail("Invalid payment method");
  result.acceptedPaymentMethods = [...new Set(methods)];
  const offsets = input.reminderOffsets || [-7, 0, 3, 7, 14];
  if (
    !Array.isArray(offsets) ||
    offsets.length > 30 || offsets.some((x) => !Number.isInteger(x) || x < -7 || x > 365)
  )
    fail("Invalid reminder timing");
  result.reminderOffsets = [...new Set(offsets)];
  const design = input.design || {};
  if (design.accentColor && !/^#[a-f\d]{6}$/i.test(design.accentColor))
    fail("Use a six-digit accent colour");
  if (
    design.fontFamily &&
    !["modern", "classic", "editorial", "sans", "serif"].includes(
      design.fontFamily,
    )
  )
    fail("Invalid document font");
  result.design = {
    coverUrl: safeCover(design.coverUrl),
    accentColor: design.accentColor || "#1f2927",
    fontFamily: design.fontFamily || "modern",
    showLogo: design.showLogo !== false,
  };
  result.paymentSchedule = [];
  if (result.paymentScheduleEnabled) {
    if (
      !Array.isArray(input.paymentSchedule) ||
      input.paymentSchedule.length < 2 ||
      input.paymentSchedule.length > 20
    )
      fail("Use between 2 and 20 scheduled payments");
    let sum = 0,
      previous = invoiceDate;
    result.paymentSchedule = input.paymentSchedule.map((p, index, arr) => {
      const final = index === arr.length - 1;
      const paymentDate = final ? dueDate : date(p.dueDate, "Payment date");
      if (
        paymentDate < invoiceDate ||
        paymentDate < previous ||
        (!final && paymentDate >= dueDate)
      )
        fail("Payment dates must be in order and before the final due date");
      const amountPaise = final ? total - sum : Number(p.amountPaise);
      if (
        !Number.isSafeInteger(amountPaise) ||
        amountPaise <= 0 ||
        amountPaise > total
      )
        fail(
          "Every scheduled payment must be positive and fit within the invoice total",
        );
      sum += amountPaise;
      previous = paymentDate;
      return { ...(p.label ? { label: text(p.label, 120) } : {}), amountPaise, dueDate: paymentDate };
    });
  }
  return result;
}
module.exports = invoiceValues;
module.exports.safeCover = safeCover;
