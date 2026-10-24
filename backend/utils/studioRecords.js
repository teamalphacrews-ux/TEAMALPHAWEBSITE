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
    const title = text(item.title, "item title", 240);
    const description = text(
      item.description,
      "item description",
      4000,
      !title,
    );
    return {
      title,
      description,
      quantity,
      unitPricePaise: number(item.unitPricePaise, "price", 1000000000, true),
    };
  });
  const subtotalPaise = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPricePaise,
    0,
  );
  const discountType = choice(body.discountType || "amount", "discount type", [
    "amount",
    "percent",
  ]);
  let discountValue, discountPaise;
  if (body.discountValue !== undefined) {
    discountValue = number(
      body.discountValue,
      "discount",
      discountType === "percent" ? 100 : subtotalPaise / 100,
    );
    if (Math.round(discountValue * 100) / 100 !== discountValue)
      bad("Discount must have at most two decimal places");
    discountPaise =
      discountType === "percent"
        ? Math.round((subtotalPaise * discountValue) / 100)
        : Math.round(discountValue * 100);
  } else {
    discountPaise = number(
      body.discountPaise ?? 0,
      "discount",
      subtotalPaise,
      true,
    );
    discountValue =
      discountType === "percent"
        ? subtotalPaise
          ? (discountPaise / subtotalPaise) * 100
          : 0
        : discountPaise / 100;
  }
  const taxRateBps = number(body.taxRateBps ?? 0, "tax rate", 10000, true);
  const taxPaise = Math.round(
    ((subtotalPaise - discountPaise) * taxRateBps) / 10000,
  );
  return {
    ...quoteMetadata(body),
    ...(body.issuer !== undefined ? { issuer: require('./invoiceBranding').issuerValues(body.issuer) } : {}),
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
      "Cancelled",
      "Archived",
    ]),
    items,
    discountPaise,
    discountType,
    discountValue,
    taxRateBps,
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise - discountPaise + taxPaise,
    terms: text(body.terms, "terms", 8000),
  };
}
function bool(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") bad("Invalid " + name);
  return value;
}
function quoteMetadata(body) {
  object(body);
  const documentNumber = text(body.documentNumber, "document number", 40);
  if (
    documentNumber &&
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/.test(documentNumber)
  )
    bad(
      "Use letters, numbers, dots, slashes or hyphens for the document number",
    );
  const reminderDays = body.reminderDays ?? [3, 7, 14, 21, 30];
  if (
    !Array.isArray(reminderDays) ||
    reminderDays.length > 12 ||
    reminderDays.some((d) => !Number.isInteger(d) || d < 1 || d > 365)
  )
    bad("Reminder days must be 1–365 days after sending");
  const design = body.design || {};
  object(design);
  const coverImage = text(design.coverImage, "cover image", 1000);
  if (
    coverImage &&
    ![
      "/assets/studio-wedding.webp",
      "/assets/studio-pre-wedding.webp",
      "/assets/banner.jpg",
      "/assets/services/wedding.jpg",
      "/assets/services/pre_wedding.jpg",
      "/assets/services/engagement.jpg",
      "/assets/services/haldi.jpg",
    ].includes(coverImage)
  )
    url(coverImage);
  const colorTheme = text(design.colorTheme || "#1f2427", "color theme", 7);
  if (!/^#[a-f0-9]{6}$/i.test(colorTheme)) bad("Use a six-digit color code");
  return {
    ...(documentNumber ? { documentNumber } : {}),
    issueDate: date(body.issueDate),
    contactId: reference(body.contactId),
    studioProjectId: reference(body.studioProjectId),
    clientPhone: text(body.clientPhone, "phone", 40),
    autoCreateInvoice: bool(body.autoCreateInvoice, "automatic invoice", true),
    expiryEnabled: bool(body.expiryEnabled, "document expiry", true),
    remindersEnabled: bool(body.remindersEnabled, "document reminders", false),
    reminderDays: [...new Set(reminderDays)].sort((a, b) => a - b),
    notes: text(body.notes, "notes", 8000),
    design: {
      coverImage,
      colorTheme,
      fontTheme: choice(design.fontTheme || "modern", "font theme", [
        "modern",
        "classic",
        "editorial",
      ]),
    },
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
  const branding = quoteMetadata({
    design: {
      coverImage: body.coverImage,
      colorTheme: body.colorTheme,
      fontTheme: body.fontTheme,
    },
  }).design;
  const upiId = text(body.upiId, "UPI ID", 100);
  if (upiId && !/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/.test(upiId))
    bad("Use a valid UPI ID");
  return {
    ...require('./studioSettings').parseAdvancedSettings(body),
    ...(body.coverImage !== undefined
      ? { coverImage: branding.coverImage }
      : {}),
    ...(body.colorTheme !== undefined
      ? { colorTheme: branding.colorTheme }
      : {}),
    ...(body.fontTheme !== undefined ? { fontTheme: branding.fontTheme } : {}),
    ...(body.bankDetails !== undefined
      ? { bankDetails: text(body.bankDetails, "bank details", 4000) }
      : {}),
    ...(body.upiId !== undefined ? { upiId } : {}),
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
  quoteMetadata,
  asset,
  settings,
  client,
  date,
  ledger,
  bookingPayment,
};
