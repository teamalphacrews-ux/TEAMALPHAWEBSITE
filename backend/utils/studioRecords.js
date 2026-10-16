function bad(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
function object(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    bad("A JSON object is required");
}
function text(value, name, max = 240, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) bad(name + " is required");
    return "";
  }
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    bad("Invalid " + name);
  if (required && !value.trim()) bad(name + " is required");
  return value.trim();
}
function email(value, required = true) {
  const result = text(value, "email", 254, required).toLowerCase();
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    bad("A valid email is required");
  return result;
}
function number(value, name, max, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (integer && !Number.isSafeInteger(value))
  )
    bad("Invalid " + name);
  return value;
}
function choice(value, name, values) {
  if (!values.includes(value)) bad("Invalid " + name);
  return value;
}
function reference(value) {
  if (!value) return null;
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    bad("Invalid project reference");
  return value;
}
function date(value) {
  if (!value) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    bad("Use a valid YYYY-MM-DD date");
  return value;
}
function url(value) {
  const v = text(value, "URL", 1000);
  if (v) {
    let parsed;
    try {
      parsed = new URL(v);
    } catch {
      bad("Use a valid HTTPS link");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      bad("Use an HTTPS link without embedded credentials");
  }
  return v;
}
function quotation(body) {
  object(body);
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 40
  )
    bad("Add between 1 and 40 quotation items");
  const items = body.items.map((item) => {
    object(item);
    const quantity = number(item.quantity, "quantity", 1000, true);
    if (!quantity) bad("Quantity must be at least one");
    return {
      description: text(item.description, "item description", 300, true),
      quantity,
      unitPricePaise: number(item.unitPricePaise, "price", 1000000000, true),
    };
  });
  const subtotalPaise = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPricePaise,
    0,
  );
  const discountPaise = number(
    body.discountPaise ?? 0,
    "discount",
    subtotalPaise,
    true,
  );
  const taxRateBps = number(body.taxRateBps ?? 0, "tax rate", 10000, true);
  const taxPaise = Math.round(
    ((subtotalPaise - discountPaise) * taxRateBps) / 10000,
  );
  return {
    clientName: text(body.clientName, "client name", 120, true),
    email: email(body.email),
    lead: reference(body.lead),
    title: text(body.title, "quotation title", 160, true),
    validUntil: date(body.validUntil),
    status: choice(body.status || "Draft", "status", [
      "Draft",
      "Sent",
      "Accepted",
      "Declined",
      "Archived",
    ]),
    items,
    discountPaise,
    taxRateBps,
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise - discountPaise + taxPaise,
    terms: text(body.terms, "terms", 8000),
  };
}
function asset(body, now = new Date()) {
  object(body);
  const backupStatus = choice(body.backupStatus || "Pending", "backup status", [
    "Pending",
    "Verified",
    "Needs attention",
  ]);
  const backupLocation = text(body.backupLocation, "backup location", 1000);
  const storageLocation = text(
    body.storageLocation,
    "storage location",
    1000,
    true,
  );
  if (backupStatus === "Verified" && !backupLocation)
    bad("A verified backup needs a recorded backup location");
  if (/\w+:\/\/[^/\s]*@/.test(storageLocation + " " + backupLocation))
    bad("Do not include credentials in storage paths");
  return {
    label: text(body.label, "record name", 160, true),
    lead: reference(body.lead),
    mediaType: choice(body.mediaType || "Photos", "media type", [
      "Photos",
      "Video",
      "Audio",
      "Project files",
      "Other",
    ]),
    storageLocation,
    sizeGb: number(body.sizeGb ?? 0, "size", 10000000),
    backupLocation,
    backupStatus,
    checksum: text(body.checksum, "checksum", 256),
    notes: text(body.notes, "notes", 4000),
    verifiedAt: backupStatus === "Verified" ? now : null,
  };
}
function settings(body) {
  object(body);
  return {
    studioName: text(body.studioName, "studio name", 120, true),
    email: email(body.email, false),
    phone: text(body.phone, "phone", 40),
    website: url(body.website),
    address: text(body.address, "address", 1000),
    invoicePrefix: text(body.invoicePrefix, "invoice prefix", 16, true),
    quotationValidityDays: number(
      body.quotationValidityDays,
      "validity days",
      365,
      true,
    ),
    quotationTerms: text(body.quotationTerms, "quotation terms", 8000),
    paymentInstructions: text(
      body.paymentInstructions,
      "payment instructions",
      4000,
    ),
    defaultDeliverables: text(body.defaultDeliverables, "deliverables", 4000),
    currency: "INR",
    timezone: "Asia/Kolkata",
  };
}
function client(body, creating = false) {
  object(body);
  const result = {
    firstName: text(body.firstName, "first name", 120, true),
    lastName: text(body.lastName, "last name", 120, true),
    email: email(body.email),
    leadId: reference(body.leadId),
    cloudLink: url(body.cloudLink),
  };
  if (creating) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password) > 72
    )
      bad("Initial password must be 8–72 bytes");
    result.password = body.password;
  }
  return result;
}
function ledger(body) {
  object(body);
  const raw = String(body.amount ?? "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    bad("Amount must have at most two decimal places");
  const paise = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 100000000000)
    bad("Enter a positive amount");
  const type = choice(body.type || "expense", "transaction type", [
    "income",
    "expense",
  ]);
  if (!body.date) bad("Transaction date is required");
  return {
    type,
    amount: paise / 100,
    description: text(body.title, "description", 300, true),
    category: text(body.category, "category", 80, true),
    date: date(body.date),
    status: choice(
      body.status,
      "status",
      type === "income" ? ["Received", "Pending"] : ["Paid", "Pending"],
    ),
  };
}
function bookingPayment(body) {
  object(body);
  const totalAmount = number(body.totalAmount, "project value", 1000000000);
  const depositAmount = number(body.depositAmount, "deposit", totalAmount);
  if (
    Math.round(totalAmount * 100) / 100 !== totalAmount ||
    Math.round(depositAmount * 100) / 100 !== depositAmount
  )
    bad("Payment amounts must have at most two decimal places");
  const paymentStatus = choice(body.paymentStatus, "payment status", [
    "Unpaid",
    "Deposit Paid",
    "Paid",
  ]);
  if (paymentStatus === "Deposit Paid" && depositAmount <= 0)
    bad("Enter the deposit received");
  return { totalAmount, depositAmount, paymentStatus };
}
module.exports = {
  quotation,
  asset,
  settings,
  client,
  date,
  ledger,
  bookingPayment,
};
