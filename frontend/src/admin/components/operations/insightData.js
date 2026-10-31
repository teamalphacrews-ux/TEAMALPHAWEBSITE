// Financial series use integer paise internally; API amounts are in rupees.
const paise = (value) => {
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : 0;
};
const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
});
export function studioMonthKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    monthFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}`;
}
export function ledgerCashFlow(entries = [], months = 6, now = new Date()) {
  const key = studioMonthKey(now);
  if (!key) return [];
  const [year, month] = key.split("-").map(Number);
  const count = Math.max(1, Math.min(12, Math.floor(months) || 6));
  const rows = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 15));
    const monthKey = studioMonthKey(date);
    return {
      key: monthKey,
      label: date.toLocaleDateString("en-IN", {
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      fullLabel: date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }),
      incomePaise: 0,
      expensesPaise: 0,
    };
  });
  const byMonth = new Map(rows.map((row) => [row.key, row]));
  for (const entry of entries) {
    const row = byMonth.get(studioMonthKey(entry.date));
    if (!row || !Number.isFinite(Number(entry.amount))) continue;
    if (entry.type === "income" && ["Received", "Paid"].includes(entry.status))
      row.incomePaise += paise(entry.amount);
    if (entry.type === "expense" && entry.status === "Paid")
      row.expensesPaise += paise(entry.amount);
  }
  return rows.map((row) => ({
    ...row,
    income: row.incomePaise / 100,
    expenses: row.expensesPaise / 100,
    net: (row.incomePaise - row.expensesPaise) / 100,
  }));
}
export function bookingCollections(leads = []) {
  let received = 0,
    remaining = 0,
    count = 0;
  for (const lead of leads) {
    if (lead.status !== "Converted") continue;
    count++;
    const total = paise(lead.totalAmount);
    const paid =
      lead.paymentStatus === "Paid"
        ? total
        : lead.paymentStatus === "Deposit Paid"
          ? Math.min(total, paise(lead.depositAmount))
          : 0;
    received += paid;
    remaining += total - paid;
  }
  return {
    count,
    received: received / 100,
    remaining: remaining / 100,
    total: (received + remaining) / 100,
  };
}
export function expenseAllocation(entries = []) {
  const categories = new Map();
  for (const entry of entries) {
    if (entry.type !== "expense" || entry.status !== "Paid") continue;
    const amount = paise(entry.amount);
    if (!amount) continue;
    const label = entry.category?.trim() || "Other";
    categories.set(label, (categories.get(label) || 0) + amount);
  }
  const total = [...categories.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
  return [...categories]
    .map(([label, amount]) => ({
      label,
      amount: amount / 100,
      percent: total ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}
export { studioDayKey as calendarDayKey } from "../../../utils/studioTime.js";
export { calendarMonthLoad } from "../calendar/calendarData.js";
