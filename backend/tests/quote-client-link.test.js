const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Quotation = require("../models/Quotation");
const QuoteDelivery = require("../models/QuoteDelivery");
const ProjectMessage = require("../models/ProjectMessage");
const { tokenHash } = require("../utils/quoteLifecycle");
const router = require("../routes/quoteWorkflowRoutes");
const adminId = "507f1f77bcf86cd79943fd01";
const clientId = "507f1f77bcf86cd79943fd02";
const quoteId = "507f1f77bcf86cd799439022";
const capability = "b".repeat(64);
const quote = { _id: quoteId, status: "Accepted", shareToken: capability, shareTokenHash: tokenHash(capability), validUntil: "2000-01-01" };
process.env.JWT_SECRET = "client-link-route-test-only";

test.beforeEach(require("./sessionFixture"));
test.beforeEach(t => {
  const previousOrigin = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://studio.example.test/";
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousOrigin;
  });
  t.mock.method(User, "findById", id => ({ select: async () => ({ _id: id, role: id === adminId ? "admin" : "client" }) }));
});

function dispatch(id = quoteId, role = "admin") {
  const bearer = role ? jwt.sign({ user: { id: role === "admin" ? adminId : clientId, role } }, process.env.JWT_SECRET) : null;
  return new Promise((resolve, reject) => {
    const headers = {};
    router.handle({
      method: "GET", url: `/quotations/${id}/client-link`, headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
      header: name => name.toLowerCase() === "authorization" && bearer ? `Bearer ${bearer}` : undefined,
    }, {
      statusCode: 200,
      set(name, value) { headers[name] = value; return this; },
      status(value) { this.statusCode = value; return this; },
      json(body) { resolve({ status: this.statusCode, body, headers }); },
    }, error => error ? reject(error) : resolve({ status: 404, headers }));
  });
}

test("existing client link requires a saved admin session before reading quotation storage", async t => {
  t.mock.method(Quotation, "findById", () => { throw Error("Must not read quotations"); });
  for (const [role, expected] of [[null, 401], ["client", 403]]) {
    const result = await dispatch(quoteId, role);
    assert.equal(result.status, expected);
    assert.equal(result.headers["Cache-Control"], "no-store");
  }
});

test("accepted and sent quotations return the exact stored capability without writes or message-read side effects", async t => {
  let current = { ...quote }, selected;
  t.mock.method(Quotation, "findById", id => {
    assert.equal(id, quoteId);
    return { select: async fields => { selected = fields; return current; } };
  });
  for (const [Model, operation] of [[Quotation, "findOneAndUpdate"], [Quotation, "findByIdAndUpdate"], [Quotation, "updateOne"], [QuoteDelivery, "updateMany"], [ProjectMessage, "updateMany"]]) {
    t.mock.method(Model, operation, () => { throw Error("Reading a link must have no side effects"); });
  }
  for (const status of ["Accepted", "Sent"]) {
    current = Object.freeze({ ...quote, status });
    const result = await dispatch();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { url: `https://studio.example.test/quote/${capability}` });
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.equal(result.headers["Referrer-Policy"], "no-referrer");
    assert.ok(selected.includes("+shareToken") && selected.includes("+shareTokenHash"));
  }
});

test("missing or malformed quotation IDs never return another document's capability", async t => {
  let lookups = 0;
  t.mock.method(Quotation, "findById", () => { lookups++; return { select: async () => null }; });
  assert.equal((await dispatch("not-an-id")).status, 404);
  assert.equal(lookups, 0);
  assert.equal((await dispatch()).status, 404);
  assert.equal(lookups, 1);
});

test("unshared lifecycle states and revoked or expired capabilities are rejected without exposing tokens", async t => {
  let current;
  t.mock.method(Quotation, "findById", () => ({ select: async () => current }));
  const inactive = [
    ...["Draft", "Declined", "Cancelled", "Archived"].map(status => ({ ...quote, status })),
    { ...quote, linkRevokedAt: new Date() },
    { ...quote, linkExpiresAt: new Date(Date.now() - 1) },
  ];
  for (current of inactive) {
    const result = await dispatch();
    assert.equal(result.status, 409);
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.ok(!JSON.stringify(result.body).includes(capability));
    assert.ok(!result.body.url);
  }
});

test("missing, malformed or mismatched stored capability pairs cannot be recovered", async t => {
  let current;
  t.mock.method(Quotation, "findById", () => ({ select: async () => current }));
  for (const patch of [{ shareToken: undefined }, { shareTokenHash: undefined }, { shareToken: "unsafe" }, { shareTokenHash: "unsafe" }, { shareTokenHash: tokenHash("c".repeat(64)) }]) {
    current = { ...quote, ...patch };
    const result = await dispatch();
    assert.equal(result.status, 409);
    assert.match(result.body.error, /cannot be recovered/);
    assert.ok(!JSON.stringify(result.body).includes(capability));
  }
});

test("returned links use the configured canonical frontend origin, never a caller-controlled origin", async t => {
  t.mock.method(Quotation, "findById", () => ({ select: async () => ({ ...quote, linkExpiresAt: new Date(Date.now() + 60000) }) }));
  process.env.FRONTEND_URL = "https://brand.example.test/site-path?ignored=1#ignored";
  assert.equal((await dispatch()).body.url, `https://brand.example.test/quote/${capability}`);
  process.env.FRONTEND_URL = "https://user:password@brand.example.test";
  const unsafe = await dispatch();
  assert.equal(unsafe.status, 503);
  assert.ok(!JSON.stringify(unsafe.body).includes(capability));
});
