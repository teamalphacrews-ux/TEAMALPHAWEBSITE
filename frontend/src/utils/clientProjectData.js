export const clientMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const clientDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "To be confirmed";
export function paymentRows(invoice, now = new Date()) {
  const total = Math.round(Number(invoice.total || 0) * 100);
  let credit =
    invoice.status === "Paid"
      ? total
      : Math.round(Number(invoice.advancePaid || 0) * 100);
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => dateParts.find((p) => p.type === type).value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return (
    invoice.paymentScheduleEnabled
      ? invoice.paymentSchedule || []
      : [{ amountPaise: total, dueDate: invoice.dueDate }]
  ).map((payment, index) => {
    const amount = Math.max(0, Number(payment.amountPaise || 0)),
      applied = Math.min(amount, credit);
    credit = Math.max(0, credit - applied);
    const remaining = amount - applied,
      date = payment.dueDate?.slice(0, 10);
    return {
      ...payment,
      number: index + 1,
      remaining,
      state: !remaining
        ? "Paid"
        : !date
          ? "Awaiting date"
          : date < today
            ? "Overdue"
            : date === today
              ? "Due today"
              : "Upcoming",
    };
  });
}
export const messageRequestId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
