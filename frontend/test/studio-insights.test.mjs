import test from "node:test";
import assert from "node:assert/strict";
import { studioDateTimeToISO } from "../src/utils/studioTime.js";
import {
  ledgerCashFlow,
  bookingCollections,
  expenseAllocation,
  calendarMonthLoad,
  studioMonthKey,
} from "../src/admin/components/operations/insightData.js";

test("cash flow includes only received income and paid expenses, with zero-filled months", () => {
  const rows = ledgerCashFlow(
    [
      { type: "income", status: "Received", date: "2026-10-05", amount: 1000 },
      { type: "income", status: "Paid", date: "2026-10-06", amount: 500 },
      { type: "expense", status: "Paid", date: "2026-10-07", amount: 250 },
      { type: "income", status: "Pending", date: "2026-10-05", amount: 9000 },
      { type: "expense", status: "Pending", date: "2026-10-05", amount: 9000 },
    ],
    3,
    new Date("2026-10-19T06:00:00Z"),
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ["2026-08", "2026-09", "2026-10"],
  );
  assert.equal(rows[0].income, 0);
  assert.equal(rows[1].expenses, 0);
  assert.equal(rows[2].income, 1500);
  assert.equal(rows[2].expenses, 250);
  assert.equal(rows[2].net, 1250);
});
test("cash flow handles year rollover, Indian month boundaries and invalid amounts", () => {
  const rows = ledgerCashFlow(
    [
      {
        type: "income",
        status: "Received",
        date: "2026-12-31T20:00:00Z",
        amount: 0.1,
      },
      { type: "income", status: "Received", date: "2027-01-02", amount: 0.2 },
      { type: "income", status: "Received", date: "bad", amount: 500 },
      {
        type: "income",
        status: "Received",
        date: "2027-01-02",
        amount: Infinity,
      },
      { type: "expense", status: "Paid", date: "2027-01-02", amount: -300 },
    ],
    6,
    new Date("2027-01-19T06:00:00Z"),
  );
  assert.equal(rows[0].key, "2026-08");
  assert.equal(rows.at(-1).key, "2027-01");
  assert.equal(rows.at(-1).income, 0.3);
  assert.equal(rows.at(-1).net, 0.3);
  assert.equal(studioMonthKey("invalid"), null);
});
test("collections use only booked CRM payments and preserve payment state semantics", () => {
  const result = bookingCollections([
    {
      status: "Converted",
      totalAmount: 1000,
      paymentStatus: "Paid",
      depositAmount: 100,
    },
    {
      status: "Converted",
      totalAmount: 2000,
      paymentStatus: "Deposit Paid",
      depositAmount: 500,
    },
    {
      status: "Converted",
      totalAmount: 300,
      paymentStatus: "Unpaid",
      depositAmount: 200,
    },
    { status: "New", totalAmount: 9000, paymentStatus: "Paid" },
    { status: "Archived", totalAmount: 9000, paymentStatus: "Paid" },
  ]);
  assert.deepEqual(result, {
    count: 3,
    received: 1500,
    remaining: 1800,
    total: 3300,
  });
  assert.deepEqual(
    bookingCollections([
      {
        status: "Converted",
        totalAmount: 100,
        paymentStatus: "Deposit Paid",
        depositAmount: 200,
      },
    ]),
    { count: 1, received: 100, remaining: 0, total: 100 },
  );
});
test("expense allocation sums numeric strings in paise and excludes unpaid records", () => {
  const rows = expenseAllocation([
    { type: "expense", status: "Paid", category: "Travel", amount: "0.10" },
    { type: "expense", status: "Paid", category: "Travel", amount: "0.20" },
    { type: "expense", status: "Paid", category: "Editing", amount: 0.7 },
    { type: "expense", status: "Pending", category: "Travel", amount: 800 },
    { type: "income", status: "Paid", category: "Travel", amount: 800 },
  ]);
  assert.deepEqual(rows, [
    { label: "Editing", amount: 0.7, percent: 70 },
    { label: "Travel", amount: 0.3, percent: 30 },
  ]);
});
test("calendar workload uses exclusive midnight boundaries and counts multi-day coverage", () => {
  const stamp = (month, day, hour = 0) =>
    studioDateTimeToISO(`2026-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`, "Asia/Kolkata");
  const result = calendarMonthLoad(
    [
      { _id: "prior", start: stamp(8, 30), end: stamp(9, 1) },
      { _id: "multi", start: stamp(9, 2, 10), end: stamp(9, 4) },
      { _id: "single", start: stamp(9, 3, 10), end: stamp(9, 3, 18) },
      { _id: "next", start: stamp(10, 1), end: stamp(10, 2) },
      { _id: "bad", start: "bad", end: stamp(9, 10) },
      { _id: "reverse", start: stamp(9, 4), end: stamp(9, 3) },
    ],
    "2026-10",
  );
  assert.equal(result.days.length, 31);
  assert.equal(result.events.length, 2);
  assert.equal(result.activeDays, 2);
  assert.equal(result.peak, 2);
  assert.deepEqual(
    result.days.slice(0, 4).map((day) => day.count),
    [0, 1, 2, 0],
  );
});
test("empty charts retain honest zero values and valid calendar days", () => {
  assert.deepEqual(bookingCollections([]), {
    count: 0,
    received: 0,
    remaining: 0,
    total: 0,
  });
  assert.deepEqual(expenseAllocation([]), []);
  assert.ok(
    ledgerCashFlow([], 6).every(
      (row) => row.income === 0 && row.expenses === 0 && row.net === 0,
    ),
  );
  const leap = calendarMonthLoad([], "2028-02");
  assert.equal(leap.days.length, 29);
  assert.equal(leap.peak, 0);
  assert.equal(leap.activeDays, 0);
});
