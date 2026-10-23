const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminUserId = "507f1f77bcf86cd79943fd01";
const clientUserId = "507f1f77bcf86cd79943fd02";
// Authorization uses the saved account role, independent of JWT role claims.
test.beforeEach((t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => id === adminUserId ? { _id: id, role: "admin" }
      : id === clientUserId ? { _id: id, role: "client" } : null,
  }));
});
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const invoiceValues = require("../utils/invoiceValues");
const {
  shareInvoice,
  sendInvoiceEmail,
} = require("../services/invoiceDelivery");
const adminRoutes = require("../routes/invoiceRoutes");
const publicRoutes = require("../routes/publicInvoiceRoutes");
const sample = {
  clientName: "Preview Client",
  clientEmail: "client@example.com",
  invoiceDate: "2026-10-16",
  dueDate: "2026-11-15",
  items: [
    {
      title: "Wedding",
      description: "Photography\nFilm",
      quantity: 3,
      unitPricePaise: 10001,
    },
  ],
  discountType: "percent",
  discountValue: 10,
  taxRateBps: 1800,
};
function dispatch(router, method, url, token, body = {}) {
  return new Promise((resolve, reject) =>
    router.handle(
      {
        method,
        url,
        body,
        headers: {},
        header: (name) => (name === "x-auth-token" ? token : null),
      },
      {
        statusCode: 200,
        set() {
          return this;
        },
        status(n) {
          this.statusCode = n;
          return this;
        },
        json(body) {
          resolve({ status: this.statusCode, body });
        },
      },
      (error) => (error ? reject(error) : resolve({ status: 404 })),
    ),
  );
}
test("invoice calculates percentage discounts and tax in integer paise", () => {
  const i = invoiceValues({ ...sample, total: 1, taxAmount: 9999 });
  assert.equal(i.discount, 30);
  assert.equal(i.taxAmount, 48.61);
  assert.equal(i.total, 318.64);
  assert.equal(i.currency, "INR");
  assert.throws(() => invoiceValues({ ...sample, discountValue: 101 }), {
    status: 400,
  });
  assert.throws(
    () =>
      invoiceValues({
        ...sample,
        items: [{ ...sample.items[0], quantity: 1.5 }],
      }),
    { status: 400 },
  );
  assert.throws(() => invoiceValues({ ...sample, advancePaid: 319 }), {
    status: 400,
  });
});
test("invoice business snapshots persist through partial edits and override current studio defaults", () => {
  const issuer = { name: "Team Alpha", address: "Invoice-specific address", email: "billing@example.com", phone: "+919800000000", logoUrl: "/team-alpha-logo.png", taxId: "TEST-TAX-ID", website: "https://example.com", bankDetails: "Invoice bank", upiId: "invoice@upi", paymentInstructions: "Use invoice number" };
  const stored = invoiceValues({ ...sample, issuer, title: "Wedding collection", clientAddress: "Client billing address" });
  const updated = invoiceValues({ notes: "Updated note" }, stored);
  assert.deepEqual(updated.issuer, stored.issuer);
  const publicValue = publicRoutes.publicInvoice(updated, { studioName: "Changed default", address: "Changed address", upiId: "different@upi" });
  assert.equal(publicValue.studio.name, "Team Alpha");
  assert.equal(publicValue.studio.address, issuer.address);
  assert.equal(publicValue.studio.logoUrl, issuer.logoUrl);
  assert.equal(publicValue.studio.upiId, issuer.upiId);
  assert.equal(publicValue.clientAddress, "Client billing address");
  assert.equal(publicValue.title, "Wedding collection");
});
test("business details validate logo URLs and exclude private injected fields", () => {
  for (const logoUrl of ["javascript:alert(1)", "http://example.com/logo.png", "https://user:secret@example.com/logo.png", "/assets/../private.png"]) {
    assert.throws(() => invoiceValues({ ...sample, issuer: { name: "Team Alpha", logoUrl } }), { status: 400 });
  }
  assert.throws(() => invoiceValues({ ...sample, issuer: { name: "" } }), { status: 400 });
  const invoice = invoiceValues({ ...sample, issuer: { name: "Team Alpha", logoUrl: "https://example.com/logo.png", password: "never-public" } });
  assert.equal(invoice.issuer.password, undefined);
  assert.equal(invoice.issuer.logoUrl, "https://example.com/logo.png");
  assert.throws(() => invoiceValues({ ...sample, leadId: "bad-id" }), { status: 400 });
});
test("schedule final payment absorbs rounding remainder and follows final date", () => {
  const i = invoiceValues({
    ...sample,
    discountValue: 0,
    taxRateBps: 0,
    paymentScheduleEnabled: true,
    paymentSchedule: [
      { amountPaise: 10000, dueDate: "2026-10-17" },
      { amountPaise: 10000, dueDate: "2026-10-30" },
      { amountPaise: 1, dueDate: "2027-01-01" },
    ],
  });
  assert.deepEqual(
    i.paymentSchedule.map((p) => p.amountPaise),
    [10000, 10000, 10003],
  );
  assert.equal(
    i.paymentSchedule[2].dueDate.toISOString().slice(0, 10),
    "2026-11-15",
  );
  for (const paymentSchedule of [
    [{ amountPaise: 10, dueDate: "2026-11-15" }, {}],
    [{ amountPaise: 40000, dueDate: "2026-10-20" }, {}],
    [
      { amountPaise: 10, dueDate: "2026-10-20" },
      { amountPaise: 10, dueDate: "2026-10-19" },
      {},
    ],
  ])
    assert.throws(
      () =>
        invoiceValues({
          ...sample,
          paymentScheduleEnabled: true,
          paymentSchedule,
        }),
      { status: 400 },
    );
});
test("invoice allowlists linked records, safe design and reminder timings", () => {
  const i = invoiceValues({
    ...sample,
    sourceQuotation: "injected",
    shareToken: "injected",
    deliveries: [{}],
    acceptedPaymentMethods: ["UPI"],
    design: {
      coverUrl: "https://example.com/cover.jpg",
      accentColor: "#112233",
      fontFamily: "classic",
    },
  });
  assert.equal(i.shareToken, undefined);
  assert.equal(i.sourceQuotation, undefined);
  assert.equal(i.deliveries, undefined);
  assert.throws(
    () =>
      invoiceValues({
        ...sample,
        design: { coverUrl: "https://user:secret@example.com/image" },
      }),
    { status: 400 },
  );
  assert.throws(() => invoiceValues({ ...sample, reminderOffsets: [100] }), {
    status: 400,
  });
  assert.throws(() => invoiceValues({ ...sample, dueDate: "2026-02-30" }), {
    status: 400,
  });
  assert.throws(() => invoiceValues({ ...sample, contactId: "bad" }), {
    status: 400,
  });
});
test("legacy invoices preserve existing tax charges during migration", () => {
  const legacy = {
    clientName: "Client",
    invoiceDate: "2026-10-16",
    events: [{ eventName: "Wedding", price: 2000 }],
    discount: 200,
    extraCharges: 324,
    taxRateBps: 1800,
  };
  assert.equal(invoiceValues(legacy).total, 2124);
  assert.equal(invoiceValues({ status: "Paid" }, legacy).total, 2124);
});
test("public invoice projection excludes email, references, tokens and delivery data", () => {
  const publicValue = publicRoutes.publicInvoice(
    {
      ...invoiceValues(sample),
      _id: "507f1f77bcf86cd799439022",
      clientEmail: "private@example.com",
      shareToken: "private",
      shareTokenHash: "private",
      contactId: "private",
      studioProjectId: "private",
      deliveries: [{ subject: "private" }],
    },
    {
      bankDetails: "Bank instructions",
      upiId: "studio@upi",
      paymentInstructions: "Use reference",
    },
  );
  for (const k of [
    "clientEmail",
    "contactId",
    "studioProjectId",
    "shareToken",
    "shareTokenHash",
    "deliveries",
    "scheduledDelivery",
  ])
    assert.equal(publicValue[k], undefined);
  assert.equal(publicValue.studio.upiId, "studio@upi");
});
test("invoice and capability routes reject unauthorized or malformed requests before storage", async (t) => {
  t.mock.method(Invoice, "find", () => {
    throw Error("No database access expected");
  });
  t.mock.method(Invoice, "findOne", () => {
    throw Error("No database access expected");
  });
  process.env.JWT_SECRET = "invoice-test-secret";
  assert.equal((await dispatch(adminRoutes, "GET", "/")).status, 401);
  const clientToken = jwt.sign(
    { user: { id: clientUserId, role: "client" } },
    process.env.JWT_SECRET,
  );
  assert.equal(
    (await dispatch(adminRoutes, "GET", "/", clientToken)).status,
    403,
  );
  assert.equal((await dispatch(publicRoutes, "GET", "/invalid")).status, 404);
});
test("public invoice tokens require sent noncancelled document and hashed lookup", async (t) => {
  const token = "c".repeat(64);
  let filter;
  t.mock.method(Invoice, "findOne", async (f) => {
    filter = f;
    return null;
  });
  assert.equal((await dispatch(publicRoutes, "GET", `/${token}`)).status, 404);
  assert.equal(filter.documentStatus, "Sent");
  assert.equal(filter.status.$ne, "Cancelled");
  assert.notEqual(filter.shareTokenHash, token);
});
test("concurrent sharing returns one stable capability and never reopens cancellation", async (t) => {
  const oldOrigin = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://studio.example";
  let stored = {
    _id: "507f1f77bcf86cd799439022",
    status: "Pending",
    documentStatus: "Draft",
  };
  t.mock.method(Invoice, "findById", () => ({
    select: async () => ({ ...stored }),
  }));
  t.mock.method(Invoice, "updateOne", async (f, u) => {
    if (
      stored.status === "Cancelled" ||
      (f.shareTokenHash?.$exists === false && stored.shareTokenHash)
    )
      return { matchedCount: 0, modifiedCount: 0 };
    stored = { ...stored, ...u.$set };
    return { matchedCount: 1, modifiedCount: 1 };
  });
  const links = await Promise.all([shareInvoice(stored), shareInvoice(stored)]);
  assert.equal(links[0], links[1]);
  assert.equal(stored.documentStatus, "Sent");
  stored.status = "Cancelled";
  await assert.rejects(() => shareInvoice(stored), { status: 409 });
  if (oldOrigin === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = oldOrigin;
});
test("sharing validates configured origin before modifying invoice", async (t) => {
  const oldOrigin = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "http://unsafe.example";
  let touched = false;
  t.mock.method(Invoice, "updateOne", async () => {
    touched = true;
  });
  await assert.rejects(() => shareInvoice({ _id: "sample" }), { status: 503 });
  assert.equal(touched, false);
  if (oldOrigin === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = oldOrigin;
});
test("local network document links require explicit development preview mode", () => {
  const { frontendOrigin } = require("../services/studioMailer");
  const old = Object.fromEntries(["FRONTEND_URL", "STUDIO_LOCAL_PREVIEW", "NODE_ENV"].map(key => [key, process.env[key]]));
  try {
    process.env.FRONTEND_URL = "http://192.168.29.248:5173";
    process.env.NODE_ENV = "development";
    delete process.env.STUDIO_LOCAL_PREVIEW;
    assert.throws(() => frontendOrigin(), { status: 503 });
    process.env.STUDIO_LOCAL_PREVIEW = "true";
    assert.equal(frontendOrigin(), "http://192.168.29.248:5173");
    process.env.NODE_ENV = "production";
    assert.throws(() => frontendOrigin(), { status: 503 });
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "http://public.example";
    assert.throws(() => frontendOrigin(), { status: 503 });
  } finally {
    for (const [key, value] of Object.entries(old)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
test("mail headers reject control characters before creating a delivery", async (t) => {
  const env = [process.env.EMAIL_USER, process.env.EMAIL_PASS];
  process.env.EMAIL_USER = "studio@example.com";
  process.env.EMAIL_PASS = "unused-test";
  t.mock.method(StudioConfig, "findOne", async () => {
    throw Error("Invalid header must not reach storage");
  });
  await assert.rejects(
    () =>
      sendInvoiceEmail(
        { clientEmail: "client@example.com" },
        { subject: "Invoice\r\nBcc: other@example.com" },
      ),
    { status: 400 },
  );
  for (const [n, k] of ["EMAIL_USER", "EMAIL_PASS"].entries())
    if (env[n] === undefined) delete process.env[k];
    else process.env[k] = env[n];
});
test("persisted delivery requests prevent repeated emails on retries", async (t) => {
  const nodemailer = require("nodemailer");
  const env = [
    process.env.EMAIL_USER,
    process.env.EMAIL_PASS,
    process.env.FRONTEND_URL,
  ];
  process.env.EMAIL_USER = "studio@example.com";
  process.env.EMAIL_PASS = "unused-test";
  process.env.FRONTEND_URL = "https://studio.example";
  let stored = {
      ...invoiceValues(sample),
      _id: "507f1f77bcf86cd799439022",
      deliveryRequests: [],
    },
    sends = 0;
  t.mock.method(Invoice, "findById", () => {
    const p = Promise.resolve({ ...stored });
    p.select = () => p;
    return p;
  });
  t.mock.method(Invoice, "updateOne", async (f, u) => {
    if (f.shareTokenHash?.$exists === false && stored.shareTokenHash)
      return { matchedCount: 0, modifiedCount: 0 };
    const request = u.$push?.deliveryRequests;
    if (request && stored.deliveryRequests.some((r) => r.key === request.key))
      return { matchedCount: 0, modifiedCount: 0 };
    if (request) stored.deliveryRequests.push(request);
    if (u.$set?.["deliveryRequests.$.state"])
      stored.deliveryRequests.find(
        (r) => r.key === f["deliveryRequests.key"],
      ).state = u.$set["deliveryRequests.$.state"];
    else stored = { ...stored, ...u.$set };
    return { matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(StudioConfig, "findOne", async () => ({
    studioName: "Sample Studio",
  }));
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => {
      sends++;
      return { accepted: ["client@example.com"], messageId: "test" };
    },
    close() {},
  }));
  await sendInvoiceEmail(stored, { requestId: "request-one" });
  const retry = await sendInvoiceEmail(stored, { requestId: "request-one" });
  assert.equal(sends, 1);
  assert.match(retry.message, /already sent/);
  for (const [n, k] of ["EMAIL_USER", "EMAIL_PASS", "FRONTEND_URL"].entries())
    if (env[n] === undefined) delete process.env[k];
    else process.env[k] = env[n];
});
