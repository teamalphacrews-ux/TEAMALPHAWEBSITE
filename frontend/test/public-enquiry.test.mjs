import test from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_OPTIONS,
  COVERAGE_OPTIONS,
  createEnquiryRequestId,
  emptyEnquiry,
  enquirySource,
  indiaToday,
  prepareEnquiryAttempt,
  validEventDate,
  validateEnquiry,
} from "../src/public/enquiryData.js";

function validValues() {
  return {
    ...emptyEnquiry(),
    name: "Aditi Rao",
    email: "aditi@example.com",
    phone: "+91 98765 43210",
    eventType: "Wedding",
    eventDate: "2027-02-14",
    eventCity: "Bengaluru",
    coverage: [COVERAGE_OPTIONS[0]],
    budget: BUDGET_OPTIONS[0],
  };
}

test("date validation uses the India calendar and rejects impossible or past dates", () => {
  assert.equal(indiaToday(new Date("2026-10-20T20:00:00Z")), "2026-10-21");
  assert.equal(validEventDate("2027-02-14", "2026-10-20"), true);
  assert.equal(validEventDate("2026-10-20", "2026-10-20"), true);
  assert.equal(validEventDate("2026-10-19", "2026-10-20"), false);
  assert.equal(validEventDate("2027-02-30", "2026-10-20"), false);
  assert.equal(validEventDate("14/02/2027", "2026-10-20"), false);
  assert.equal(validEventDate("2028-02-29", "2026-10-20"), true);
});

test("validation requires contact, celebration and coverage without implying availability", () => {
  assert.deepEqual(validateEnquiry(validValues(), null, "2026-10-20"), {});
  assert.deepEqual(Object.keys(validateEnquiry(emptyEnquiry(), 0)), [
    "name",
    "email",
    "phone",
  ]);
  const pending = { ...validValues(), datePending: true, eventDate: "" };
  assert.equal(validateEnquiry(pending, 1).eventDate, undefined);
  assert.ok(
    validateEnquiry({
      ...validValues(),
      eventCity: "x",
      coverage: [],
      budget: "Cheap",
    }).coverage,
  );
  assert.ok(
    validateEnquiry({ ...validValues(), coverage: ["Unpublished service"] })
      .coverage,
  );
});

test("field length boundaries and malformed contact fields are enforced", () => {
  const values = {
    ...validValues(),
    name: "a".repeat(100),
    venue: "v".repeat(200),
    details: "d".repeat(3000),
  };
  assert.deepEqual(validateEnquiry(values, null, "2026-10-20"), {});
  const errors = validateEnquiry({
    ...values,
    name: "a".repeat(101),
    venue: "v".repeat(201),
    details: "d".repeat(3001),
    email: "no-address",
    phone: "+91 script()",
  });
  assert.deepEqual(Object.keys(errors), [
    "name",
    "email",
    "phone",
    "venue",
    "details",
  ]);
});

test("retry snapshots keep an immutable payload and request identifier until the caller replaces them", () => {
  const values = validValues();
  values.name = "  Aditi Rao  ";
  const attempt = prepareEnquiryAttempt(values, {
    startedAt: 123456,
    source: "website:/enquire",
    requestId: "ta_reusable_request",
  });
  const original = attempt.serialized;
  values.name = "Someone Else";
  values.coverage.push(COVERAGE_OPTIONS[1]);
  assert.equal(attempt.body.name, "Aditi Rao");
  assert.equal(attempt.body.coverage.length, 1);
  assert.equal(attempt.requestId, "ta_reusable_request");
  assert.equal(attempt.serialized, original);
  assert.equal(JSON.parse(original).startedAt, 123456);
  assert.equal(JSON.parse(original).requestId, "ta_reusable_request");
  assert.throws(() => attempt.body.coverage.push("mutate"), TypeError);
  assert.equal(
    prepareEnquiryAttempt(
      { ...validValues(), datePending: true },
      { startedAt: 1, source: "website:/enquire", requestId: "new" },
    ).body.eventDate,
    "",
  );
});

test("source tracking retains approved portfolio context and excludes tokens and personal data", () => {
  assert.equal(
    enquirySource({
      pathname: "/enquire",
      search:
        "?story=ananya-arjun&token=secret&email=name%40example.com&category=Wedding+Stories",
    }),
    "website:/enquire?story=ananya-arjun&category=Wedding+Stories",
  );
  assert.equal(
    enquirySource({
      pathname: "/quote/private-token",
      search: "?story=https://secret",
    }),
    "website:/enquire",
  );
});

test("request IDs use getRandomValues without requiring secure-context randomUUID", () => {
  const cryptoSource = {
    getRandomValues: (bytes) => {
      bytes.fill(171);
      return bytes;
    },
  };
  assert.equal(createEnquiryRequestId(cryptoSource), `ta_${"ab".repeat(16)}`);
  assert.throws(() => createEnquiryRequestId({}), /secure request identifier/);
});

test("collection and location hints stay bounded and exclude arbitrary query data", () => {
  assert.equal(
    enquirySource({
      pathname: "/enquire",
      search:
        "?collection=signature&location=bengaluru&interest=cinematography&name=Private+Person&phone=919876543210&token=private-secret&email=person%40example.com",
    }),
    "website:/enquire?collection=signature&location=bengaluru&interest=cinematography",
  );
  assert.equal(
    enquirySource({
      pathname: "/enquire",
      search: `?collection=${"x".repeat(81)}&location=https%3A%2F%2Fprivate.example&interest=${"a".repeat(64)}&story=607f1f77bcf86cd799439055&category=919876543210`,
    }),
    "website:/enquire",
  );
  const allHints = new URLSearchParams();
  for (const key of ["story", "category", "collection", "location", "interest"])
    allHints.set(key, `a${"z".repeat(79)}`);
  assert.ok(
    enquirySource({ pathname: "/enquire", search: allHints.toString() })
      .length <= 500,
  );
});
