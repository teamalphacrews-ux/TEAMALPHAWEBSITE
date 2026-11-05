import test from "node:test";
import assert from "node:assert/strict";
import { contactPaymentTotals } from "../src/admin/components/contacts/contactPaymentTotals.js";
const now = new Date("2026-10-16T06:00:00Z");
test("draft and cancelled invoices never inflate client payment cards", () => {
  assert.deepEqual(contactPaymentTotals([{ total: 1000, advancePaid: 200, documentStatus: "Draft" }, { total: 500, status: "Cancelled" }, { total: 600, documentStatus: "Cancelled" }], now), { paid: 0, upcoming: 0, pastDue: 0 });
});
test("paid invoices have no outstanding balance even when advance is a partial legacy value", () => {
  assert.deepEqual(contactPaymentTotals([{ total: 123.45, advancePaid: 10, documentStatus: "Sent", status: "Paid", dueDate: "2026-10-01" }], now), { paid: 123.45, upcoming: 0, pastDue: 0 });
});
test("scheduled payments allocate advances to earliest installments and split overdue from upcoming", () => {
  const result = contactPaymentTotals([{ total: 1000, advancePaid: 100, documentStatus: "Sent", status: "Pending", dueDate: "2026-11-01", paymentScheduleEnabled: true, paymentSchedule: [{ amountPaise: 30000, dueDate: "2026-10-01" }, { amountPaise: 70000, dueDate: "2026-11-01" }] }], now);
  assert.deepEqual(result, { paid: 100, pastDue: 200, upcoming: 700 });
});
test("payment deadlines use the studio's Indian calendar date and treat today as upcoming", () => {
  const invoices = [{ total: 10.01, dueDate: "2026-10-16", documentStatus: "Sent" }, { total: 20.02, dueDate: "2026-10-15", documentStatus: "Sent" }];
  assert.deepEqual(contactPaymentTotals(invoices, new Date("2026-10-15T20:00:00Z")), { paid: 0, upcoming: 10.01, pastDue: 20.02 });
});
