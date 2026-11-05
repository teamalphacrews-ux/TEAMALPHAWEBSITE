import test from "node:test";
import assert from "node:assert/strict";
import { quotationExpiryTime, quotationStatus } from "../src/utils/quotationStatus.js";

test("sent quotations display Open, independently of email delivery state", () => {
  assert.equal(quotationStatus({ status: "Sent", expiryEnabled: false, deliveries: [{ status: "failed" }] }), "Open");
  assert.equal(quotationStatus({ status: "Draft", expiryEnabled: false, deliveries: [{ status: "sent" }] }), "Draft");
  assert.equal(quotationStatus({ status: "Open", expiryEnabled: false }), "Open");
});

test("selected expiry date remains valid through 11:59 PM IST, then expires at the boundary", () => {
  const quote = { status: "Sent", validUntil: "2026-10-25T00:00:00.000Z" };
  assert.equal(quotationExpiryTime(quote), Date.parse("2026-10-25T18:30:00Z"));
  assert.equal(quotationStatus(quote, new Date("2026-10-25T18:29:59.999Z")), "Open");
  assert.equal(quotationStatus(quote, Date.parse("2026-10-25T18:30:00Z")), "Expired");
  assert.equal(quotationStatus({ ...quote, status: "Draft" }, Date.parse("2026-10-26T00:00:00Z")), "Expired");
});

test("accepted, declined, cancelled and archived lifecycle states do not become expired", () => {
  for (const status of ["Accepted", "Declined", "Cancelled", "Archived", "Expired"]) {
    assert.equal(quotationStatus({ status, validUntil: "2020-01-01" }, Date.parse("2026-10-25")), status);
  }
});

test("disabled expiry and missing or invalid legacy dates remain safe", () => {
  assert.equal(quotationStatus({ status: "Sent", expiryEnabled: false, validUntil: "2020-01-01", expiresAt: "2020-01-01" }), "Open");
  assert.equal(quotationStatus({ status: "Sent" }), "Open");
  assert.equal(quotationStatus({ status: "Sent", validUntil: "bad-date" }), "Open");
  assert.equal(quotationStatus(), "Draft");
  assert.equal(quotationExpiryTime({ validUntil: "bad-date" }), null);
});

test("explicit server expiry takes precedence and never changes the source record", () => {
  const quote = Object.freeze({ status: "Sent", validUntil: "2026-10-25", expiresAt: "2026-10-26T00:00:00Z" });
  assert.equal(quotationStatus(quote, Date.parse("2026-10-25T19:00:00Z")), "Open");
  assert.equal(quotationStatus(quote, Date.parse("2026-10-26T00:00:00Z")), "Expired");
  assert.equal(quote.status, "Sent");
});
