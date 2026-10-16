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
const StudioConfig = require("../models/StudioConfig");
const router = require("../routes/publicQuoteRoutes");
const token = "a".repeat(64);
const quote = {
  _id: "507f1f77bcf86cd799439022",
  revision: 2,
  status: "Sent",
  clientName: "Sample Client",
  email: "private@example.com",
  lead: "private-project",
  validUntil: new Date("2099-12-31"),
  items: [{ description: "Wedding", quantity: 2, unitPricePaise: 100000 }],
  subtotalPaise: 200000,
  discountPaise: 20000,
  taxRateBps: 1800,
  taxPaise: 32400,
  totalPaise: 212400,
  terms: "Sample terms",
};
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
  assert.equal(i.extraCharges, 324);
  assert.equal(i.sourceRevision, 2);
  assert.equal(i.sourceQuotation, quote._id);
  assert.equal(invoiceValues(i).total, 2124);
  assert.equal(invoiceValues({ ...i, discount: 300, total: 1 }).total, 2024);
  assert.throws(() => invoiceValues({ ...i, discount: 3000 }), { status: 400 });
  assert.throws(() => invoiceValues({ ...i, discount: -1 }), { status: 400 });
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
  let q = { ...quote },
    claims = 0;
  const invoiceIds = new Set();
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
      invoiceIds.add(String(filter._id));
      return {};
    },
  );
  t.mock.method(StudioConfig, "findOne", async () => ({
    studioName: "Sample Studio",
  }));
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
  assert.equal(invoiceIds.size, 1);
});
test("acceptance retry repairs an interrupted invoice insert without a second invoice", async (t) => {
  let q = { ...quote },
    invoiceId,
    attempts = 0;
  t.mock.method(Quotation, "findOne", async () => ({ ...q }));
  t.mock.method(Quotation, "findOneAndUpdate", async (f, u) => {
    q = { ...q, ...u.$set };
    invoiceId = String(q.invoiceId);
    return q;
  });
  t.mock.method(Invoice, "findOneAndUpdate", async (f) => {
    assert.equal(String(f._id), invoiceId);
    if (++attempts === 1) throw Error("storage interruption");
    return {};
  });
  t.mock.method(StudioConfig, "findOne", async () => ({}));
  const body = { acceptedBy: "Sample Person", consent: true, revision: 2 };
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 503);
  assert.equal((await dispatch("POST", `/${token}/accept`, body)).status, 200);
  assert.equal(attempts, 2);
});
