const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const records = require("../utils/studioRecords");
const { eventFields, crewOverlap } = require("../utils/studioCalendar");
const quote = {
  clientName: "Maya",
  email: "MAYA@example.com",
  title: "Wedding collection",
  items: [{ description: "Photography", quantity: 3, unitPricePaise: 10001 }],
  discountPaise: 1,
  taxRateBps: 1800,
  validUntil: "2028-02-29",
};
test("quotation totals use integer paise and recompute untrusted totals", () => {
  const result = records.quotation({
    ...quote,
    totalPaise: 1,
    revision: 900,
    role: "admin",
  });
  assert.equal(result.subtotalPaise, 30003);
  assert.equal(result.taxPaise, 5400);
  assert.equal(result.totalPaise, 35402);
  assert.equal(result.email, "maya@example.com");
  assert.equal(result.revision, undefined);
  assert.equal(result.role, undefined);
});
test("invalid prices, excessive discounts and invalid calendar dates are rejected", () => {
  for (const values of [
    { ...quote, items: [] },
    {
      ...quote,
      items: [{ description: "Photo", quantity: 1.5, unitPricePaise: 1 }],
    },
    {
      ...quote,
      items: [{ description: "Photo", quantity: 1, unitPricePaise: -1 }],
    },
    { ...quote, discountPaise: 40000 },
    { ...quote, taxRateBps: 10001 },
    { ...quote, validUntil: "2027-02-29" },
  ])
    assert.throws(() => records.quotation(values), { status: 400 });
});
test("backup metadata cannot claim a checked backup without a location or store embedded credentials", () => {
  assert.throws(
    () =>
      records.asset({
        label: "Wedding",
        storageLocation: "/shoots",
        backupStatus: "Verified",
      }),
    { status: 400 },
  );
  assert.throws(
    () =>
      records.asset({
        label: "Wedding",
        storageLocation: "smb://user:password@nas/shoots",
      }),
    { status: 400 },
  );
  const now = new Date("2026-10-16T00:00:00Z");
  assert.equal(
    records.asset(
      {
        label: "Wedding",
        storageLocation: "/shoots",
        backupStatus: "Verified",
        backupLocation: "/offsite",
      },
      now,
    ).verifiedAt,
    now,
  );
  assert.equal(
    records.asset({
      label: "Wedding",
      storageLocation: "/shoots",
      backupStatus: "Pending",
    }).verifiedAt,
    null,
  );
});
test("studio preferences keep fixed currency and timezone and exclude security fields", () => {
  const result = records.settings({
    studioName: "Team Alpha",
    invoicePrefix: "TA",
    quotationValidityDays: 14,
    currency: "USD",
    timezone: "Elsewhere",
    JWT_SECRET: "ignored",
    email: "studio@example.com",
  });
  assert.equal(result.currency, "INR");
  assert.equal(result.timezone, "Asia/Kolkata");
  assert.equal(result.JWT_SECRET, undefined);
  assert.throws(
    () =>
      records.settings({
        studioName: "TA",
        invoicePrefix: "TA",
        quotationValidityDays: 366,
      }),
    { status: 400 },
  );
});
test("client updates whitelist identity and project link without changing role or credentials", () => {
  const result = records.client({
    firstName: "Maya",
    lastName: "Shah",
    email: "MAYA@example.com",
    role: "admin",
    password: "ignored",
  });
  assert.equal(result.email, "maya@example.com");
  assert.equal(result.role, undefined);
  assert.equal(result.password, undefined);
  assert.throws(
    () =>
      records.client(
        {
          firstName: "Maya",
          lastName: "Shah",
          email: "a@b.in",
          password: "short",
        },
        true,
      ),
    { status: 400 },
  );
  assert.throws(
    () =>
      records.client({
        firstName: "Maya",
        lastName: "Shah",
        email: "a@b.in",
        cloudLink: "https://user:pass@host/folder",
      }),
    { status: 400 },
  );
});
test("ledger amounts have two-decimal precision and valid directional statuses", () => {
  const valid = {
    title: "Travel",
    category: "Travel",
    amount: "123.45",
    date: "2026-10-16",
    type: "expense",
    status: "Paid",
  };
  assert.equal(records.ledger(valid).amount, 123.45);
  for (const amount of ["-1", "0", "1.001", "NaN", "Infinity", "1e6"])
    assert.throws(() => records.ledger({ ...valid, amount }), { status: 400 });
  assert.throws(
    () => records.ledger({ ...valid, type: "income", status: "Paid" }),
    { status: 400 },
  );
});
test("calendar validation strips sync ownership fields and rejects reversed events", () => {
  const body = {
    title: "Wedding",
    start: "2026-10-18T10:00:00Z",
    end: "2026-10-18T18:00:00Z",
    teamMembers: [" Arun ", "Arun"],
    googleEventId: "injected",
    isReadOnly: false,
    userId: "other",
  };
  const result = eventFields(body);
  assert.deepEqual(result.teamMembers, ["Arun"]);
  assert.equal(result.googleEventId, undefined);
  assert.equal(result.userId, undefined);
  assert.throws(() => eventFields({ ...body, end: body.start }), {
    status: 400,
  });
});
test("server calendar checks shared crew, permits independent and adjacent shoots", () => {
  const event = eventFields({
    title: "A",
    start: "2026-10-18T10:00:00Z",
    end: "2026-10-18T12:00:00Z",
    teamMembers: ["Arun"],
  });
  assert.equal(
    crewOverlap(event, [
      {
        title: "B",
        start: "2026-10-18T11:00:00Z",
        end: "2026-10-18T13:00:00Z",
        teamMembers: ["Sara"],
      },
    ]),
    undefined,
  );
  assert.equal(
    crewOverlap(event, [
      {
        title: "B",
        start: "2026-10-18T12:00:00Z",
        end: "2026-10-18T13:00:00Z",
        teamMembers: ["Arun"],
      },
    ]),
    undefined,
  );
  assert.equal(
    crewOverlap(event, [
      {
        title: "B",
        start: "2026-10-18T11:00:00Z",
        end: "2026-10-18T13:00:00Z",
        teamMembers: [" arun "],
      },
    ]).title,
    "B",
  );
});
function dispatch(router, method, url, body, role = "admin") {
  const token = jwt.sign(
    { user: { id: "507f1f77bcf86cd799439011", role } },
    process.env.JWT_SECRET,
  );
  return new Promise((resolve, reject) =>
    router.handle(
      {
        method,
        url,
        body,
        headers: { authorization: "Bearer " + token },
        header: (name) =>
          name.toLowerCase() === "authorization"
            ? "Bearer " + token
            : undefined,
      },
      {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
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
process.env.JWT_SECRET = "test-only-new-studio-modules-secret";
const router = require("../routes/studioRoutes");
test("every expanded studio route denies client access before storage operations", async () => {
  for (const [method, path] of [
    ["GET", "/finance"],
    ["PATCH", "/booking-payments/x"],
    ["DELETE", "/ledger/x"],
    ["GET", "/settings"],
    ["PUT", "/settings"],
    ["GET", "/clients"],
    ["POST", "/clients"],
    ["PATCH", "/clients/x"],
    ["GET", "/quotations"],
    ["POST", "/quotations"],
    ["PUT", "/quotations/x"],
    ["GET", "/assets"],
    ["POST", "/assets"],
    ["PUT", "/assets/x"],
    ["DELETE", "/assets/x"],
    ["POST", "/ledger"],
    ["PUT", "/ledger/x"],
  ])
    assert.equal(
      (await dispatch(router, method, path, {}, "client")).status,
      403,
      method + " " + path,
    );
});
test("quotation update uses an atomic revision lease and returns conflict rather than overwriting", async (t) => {
  const Quotation = require("../models/Quotation");
  let captured;
  t.mock.method(Quotation, "findOneAndUpdate", async (filter, update) => {
    captured = { filter, update };
    return null;
  });
  const result = await dispatch(
    router,
    "PUT",
    "/quotations/507f1f77bcf86cd799439022",
    { ...quote, revision: 4 },
  );
  assert.equal(result.status, 409);
  assert.equal(captured.filter.revision, 4);
  assert.equal(captured.update.$inc.revision, 1);
  assert.equal(captured.update.$set.totalPaise, 35402);
});
test("editing backup notes preserves the original verification timestamp", async (t) => {
  const Asset = require("../models/AssetRecord");
  const verifiedAt = new Date("2026-01-01");
  let captured;
  t.mock.method(Asset, "findOne", async () => ({
    backupStatus: "Verified",
    storageLocation: "/primary",
    backupLocation: "/backup",
    verifiedAt,
  }));
  t.mock.method(Asset, "findOneAndUpdate", async (filter, update) => {
    captured = update;
    return { _id: "record", ...update.$set };
  });
  const result = await dispatch(
    router,
    "PUT",
    "/assets/507f1f77bcf86cd799439033",
    {
      label: "Wedding",
      storageLocation: "/primary",
      backupLocation: "/backup",
      backupStatus: "Verified",
      notes: "Only notes changed",
    },
  );
  assert.equal(result.status, 200);
  assert.equal(captured.$set.verifiedAt, verifiedAt);
});

test("booking payment records validate monetary precision and deposit bounds", () => {
  const body = {
    totalAmount: 10000.5,
    depositAmount: 2000,
    paymentStatus: "Deposit Paid",
    role: "admin",
  };
  assert.deepEqual(records.bookingPayment(body), {
    totalAmount: 10000.5,
    depositAmount: 2000,
    paymentStatus: "Deposit Paid",
  });
  for (const patch of [
    { depositAmount: 20000 },
    { totalAmount: -1 },
    { depositAmount: 0 },
    { totalAmount: 10.001 },
    { paymentStatus: "Unknown" },
  ])
    assert.throws(() => records.bookingPayment({ ...body, ...patch }), {
      status: 400,
    });
});
