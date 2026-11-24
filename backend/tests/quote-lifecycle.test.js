const test = require("node:test");
const assert = require("node:assert/strict");
const {
  expiryAt,
  expired,
  invoiceFromQuote,
  publicQuote,
  tokenHash,
} = require("../utils/quoteLifecycle");
const invoiceValues = require("../utils/invoiceValues");
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Counter = require("../models/DocumentCounter");
const { nextDocumentNumber } = require("../services/documentNumbering");
test.beforeEach(t => { t.mock.method(Invoice, 'exists', async () => null); });
const StudioConfig = require("../models/StudioConfig");
const router = require("../routes/publicQuoteRoutes");
const token = "a".repeat(64);
const quote = {
  _id: "507f1f77bcf86cd799439022",
  revision: 2,
  status: "Sent",
  clientName: "Sample Client",
  email: "private@example.com",
  lead: "507f1f77bcf86cd799439011",
  validUntil: new Date("2099-12-31"),
  items: [{ description: "Wedding", quantity: 2, unitPricePaise: 100000 }],
  subtotalPaise: 200000,
  discountPaise: 20000,
  taxRateBps: 1800,
  taxPaise: 32400,
  totalPaise: 212400,
  terms: "Sample terms",
};

function mockNumbering(t) {
  const rows = new Map();
  t.mock.method(Counter, "findById", async id => {
    const row = rows.get(id);
    return row && { ...row, pendingInvoices: new Map(row.pendingInvoices) };
  });
  t.mock.method(Counter, "findOneAndUpdate", async (filter, update, options) => {
    let row = rows.get(filter._id);
    if (row && (filter.value?.$exists === false || typeof filter.value === "number" && row.value !== filter.value)) return null;
    if (!row) {
      assert.equal(options.upsert, true);
      row = { ...update.$setOnInsert, pendingInvoices: new Map() };
      rows.set(filter._id, row);
    }
    if (update.$inc) row.value = (row.value || 0) + update.$inc.value;
    for (const [path, value] of Object.entries(update.$set || {})) {
      row.pendingInvoices.set(path.split(".").at(-1), value);
    }
    return { ...row };
  });
  t.mock.method(Counter, "updateOne", async ({ _id }, { $unset }) => {
    for (const path of Object.keys($unset)) rows.get(_id)?.pendingInvoices.delete(path.split(".").at(-1));
  });
  t.mock.method(Counter, "deleteOne", async ({ _id }) => rows.delete(_id));
  return rows;
}

const sequentialStudio = {
  studioName: "Sample Studio",
  billingDefaults: { numberingMode: "sequence", invoicePrefix: "AUD-INV" },
};

test("workspace archives can round-trip pending sequence reservations in the existing counter collection", () => {
  const archive = require("../utils/workspaceArchive");
  const invoiceId = quote._id;
  const rows = [
    new Counter({ _id: "invoice:AUD-INV", value: 1, pendingInvoices: { [invoiceId]: 1 } }),
    new Counter({ _id: `invoice-reservation:${invoiceId}`, invoiceNumbering: { stem: "AUD-INV", mode: "sequence" } }),
  ];
  const exported = rows.map(row => archive.exportRecord("DocumentCounter", row));
  const restored = exported.map(row => new Counter(JSON.parse(JSON.stringify(row))));
  assert.equal(restored[0].pendingInvoices.get(invoiceId), 1);
  assert.equal(restored[1].invoiceNumbering.mode, "sequence");
  assert.ok(restored.every(row => row.validateSync() === undefined));
});
function dispatch(method, url, body = {}) {
  return new Promise((resolve, reject) =>
    router.handle(
      { method, url, body, headers: {} },
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
      (err) => (err ? reject(err) : resolve({ status: 404 })),
    ),
  );
}
test("expiry is exactly midnight after the selected day in India", () => {
  assert.equal(
    expiryAt("2026-10-31").toISOString(),
    "2026-10-31T18:30:00.000Z",
  );
  assert.equal(
    expired(
      { ...quote, validUntil: "2026-10-31" },
      new Date("2026-10-31T18:29:59Z"),
    ),
    false,
  );
  assert.equal(
    expired(
      { ...quote, validUntil: "2026-10-31" },
      new Date("2026-10-31T18:30:00Z"),
    ),
    true,
  );
});
test("public quotation excludes private email, project and capability fields", () => {
  const q = publicQuote(
    { ...quote, shareToken: token, shareTokenHash: tokenHash(token) },
    {},
  );
  for (const key of [
    "email",
    "lead",
    "shareToken",
    "shareTokenHash",
    "history",
  ])
    assert.equal(q[key], undefined);
});
test("invoice conversion preserves exact discounted and taxed quote totals", () => {
  const i = invoiceFromQuote({ ...quote, acceptedAt: new Date() });
  assert.equal(i.total, 2124);
  assert.equal(i.discount, 200);
  assert.equal(i.extraCharges, 0);
  assert.equal(i.sourceRevision, 2);
  assert.equal(i.sourceQuotation, quote._id);
  assert.equal(i.leadId, quote.lead);
  assert.equal(invoiceValues(i).total, 2124);
  assert.equal(invoiceValues({ ...i, discount: 300, discountValue: 300, total: 1 }).total, 2006);
  assert.throws(() => invoiceValues({ ...i, discountValue: 3000 }), { status: 400 });
  assert.throws(() => invoiceValues({ ...i, discountValue: -1 }), { status: 400 });
});
test("invalid links and missing consent never claim a quotation", async (t) => {
  let touched = false;
  t.mock.method(Quotation, "findOne", async () => {
    touched = true;
    return quote;
  });
  assert.equal((await dispatch("GET", "/invalid")).status, 404);
  assert.equal(touched, false);
  assert.equal(
    (
      await dispatch("POST", `/${token}/accept`, {
        acceptedBy: "Person",
        revision: 2,
      })
    ).status,
    400,
  );
  assert.equal(touched, false);
});
test("expired and stale revisions cannot generate invoices", async (t) => {
  let q = { ...quote, validUntil: new Date("2000-01-01") };
  t.mock.method(Quotation, "findOne", async () => q);
  t.mock.method(Invoice, "findOneAndUpdate", () => {
    throw Error("Must not create invoice");
  });
  const body = { acceptedBy: "Sample Person", consent: true, revision: 2 };
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 410);
  q = quote;
  assert.equal(
    (await dispatch("POST", `/${token}/accept`, { ...body, revision: 1 }))
      .status,
    409,
  );
});
test("concurrent acceptance and retries use one atomic claim and one invoice ID", async (t) => {
  t.mock.method(require('../services/enquiryPipeline'), 'syncQuote', async () => null);
  const counters = mockNumbering(t);
  let q = { ...quote },
    claims = 0;
  const invoices = new Map();
  t.mock.method(Invoice, "findById", async id => invoices.get(String(id)));
  t.mock.method(Quotation, "findOne", async () => ({ ...q }));
  t.mock.method(Quotation, "findOneAndUpdate", async (filter, update) => {
    if (update.$set.invoiceGeneratedAt) {
      q = { ...q, ...update.$set };
      return { ...q };
    }
    assert.equal(filter.status, "Sent");
    assert.equal(filter.revision, 2);
    assert.equal(filter.shareTokenHash, tokenHash(token));
    assert.ok(filter.validUntil.$gt instanceof Date);
    if (q.status !== "Sent") return null;
    claims++;
    q = { ...q, ...update.$set };
    return { ...q };
  });
  t.mock.method(
    Invoice,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(options.upsert, true);
      assert.equal(update.$setOnInsert.total, 2124);
      assert.equal(options.timestamps, false);
      const invoiceId = String(filter._id);
      if (!invoices.has(invoiceId)) invoices.set(invoiceId, update.$setOnInsert);
      return invoices.get(invoiceId);
    },
  );
  t.mock.method(StudioConfig, "findOne", async () => sequentialStudio);
  const body = { acceptedBy: "Sample Person", consent: true, revision: 2 };
  const results = await Promise.all([
    dispatch("POST", `/${token}/accept`, body),
    dispatch("POST", `/${token}/accept`, body),
  ]);
  for (const r of results) {
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "Accepted");
  }
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 200);
  assert.equal(claims, 1);
  assert.equal(invoices.size, 1);
  assert.equal(invoices.get(String(q.invoiceId)).documentNumber, "AUD-INV-000001");
  assert.equal(counters.get("invoice:AUD-INV").value, 1);
  assert.equal(counters.get("invoice:AUD-INV").pendingInvoices.size, 0);
  assert.equal(counters.size, 1);
  assert.equal(await nextDocumentNumber("invoice", sequentialStudio), "AUD-INV-000002");
});
test("an interrupted invoice insert resumes its original sequence across a numbering settings change", async (t) => {
  t.mock.method(require('../services/enquiryPipeline'), 'syncQuote', async () => null);
  const counters = mockNumbering(t);
  let q = { ...quote },
    invoiceId,
    attempts = 0,
    invoice;
  let studio = sequentialStudio;
  t.mock.method(Invoice, "findById", async () => invoice);
  t.mock.method(Quotation, "findOne", async () => ({ ...q }));
  t.mock.method(Quotation, "findOneAndUpdate", async (f, u) => {
    q = { ...q, ...u.$set };
    invoiceId = String(q.invoiceId);
    return q;
  });
  t.mock.method(Invoice, "findOneAndUpdate", async (f, update) => {
    assert.equal(String(f._id), invoiceId);
    if (++attempts === 1) throw Error("storage interruption");
    invoice = update.$setOnInsert;
    return invoice;
  });
  t.mock.method(StudioConfig, "findOne", async () => studio);
  const body = { acceptedBy: "Sample Person", consent: true, revision: 2 };
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 503);
  assert.equal(counters.get("invoice:AUD-INV").pendingInvoices.get(invoiceId), 1);
  studio = { billingDefaults: { numberingMode: "sequence", invoicePrefix: "AFTER-CHANGE" } };
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 200);
  assert.equal(attempts, 2);
  assert.equal(invoice.documentNumber, "AUD-INV-000001");
  assert.equal(counters.has("invoice:AFTER-CHANGE"), false);
  assert.equal(counters.get("invoice:AUD-INV").pendingInvoices.size, 0);
});
