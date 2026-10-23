export function contactPaymentTotals(invoices, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const totals = { paid: 0, upcoming: 0, pastDue: 0 };
  for (const invoice of invoices) {
    if (
      ["Draft", "Cancelled", "Archived"].includes(invoice.documentStatus) ||
      invoice.status === "Cancelled"
    )
      continue;
    const total = Math.max(0, Math.round((Number(invoice.total) || 0) * 100));
    const paid =
      invoice.status === "Paid"
        ? total
        : Math.min(
            total,
            Math.max(0, Math.round((Number(invoice.advancePaid) || 0) * 100)),
          );
    totals.paid += paid;
    const schedule =
      invoice.paymentScheduleEnabled && invoice.paymentSchedule?.length
        ? [...invoice.paymentSchedule].sort((a, b) =>
            String(a.dueDate).localeCompare(String(b.dueDate)),
          )
        : [];
    if (
      schedule.length &&
      schedule.reduce((sum, item) => sum + item.amountPaise, 0) === total
    ) {
      let remainingPaid = paid;
      for (const installment of schedule) {
        const applied = Math.min(remainingPaid, installment.amountPaise);
        remainingPaid -= applied;
        const key =
          installment.dueDate &&
          String(installment.dueDate).slice(0, 10) < today
            ? "pastDue"
            : "upcoming";
        totals[key] += installment.amountPaise - applied;
      }
    } else {
      const key =
        invoice.dueDate && String(invoice.dueDate).slice(0, 10) < today
          ? "pastDue"
          : "upcoming";
      totals[key] += total - paid;
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, value / 100]),
  );
}
