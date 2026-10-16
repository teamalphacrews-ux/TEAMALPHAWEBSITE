function invoiceValues(body, existing = {}) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  const input = { ...existing, ...body };
  const money = (v, label) => {
    const n = Number(v ?? 0);
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      n > 1e12 ||
      Math.round(n * 100) / 100 !== n
    )
      fail(label + " must be a non-negative amount with up to two decimals");
    return Math.round(n * 100);
  };
  if (
    typeof input.clientName !== "string" ||
    !input.clientName.trim() ||
    input.clientName.length > 120
  )
    fail("Client name is required");
  if (!input.invoiceDate || !Number.isFinite(Date.parse(input.invoiceDate)))
    fail("Invoice date is required");
  if (!Array.isArray(input.events) || input.events.length > 40)
    fail("Use up to 40 invoice items");
  const events = input.events.map((e) => ({
    eventName: String(e.eventName || "").slice(0, 4000),
    services: String(e.services || "").slice(0, 4000),
    equipment: String(e.equipment || "").slice(0, 1000),
    dateLocation: String(e.dateLocation || "").slice(0, 1000),
    price: money(e.price, "Item price") / 100,
  }));
  const deliverablesPrice = money(input.deliverablesPrice, "Deliverables");
  const extraCharges = money(input.extraCharges, "Extra charges");
  const subtotal =
    events.reduce((s, e) => s + Math.round(e.price * 100), 0) +
    deliverablesPrice;
  const discount = money(input.discount, "Discount");
  if (discount > subtotal) fail("Discount cannot exceed the subtotal");
  const total = subtotal - discount + extraCharges;
  const advancePaid = money(input.advancePaid, "Advance");
  if (advancePaid > total) fail("Advance cannot exceed the total");
  const status = input.status || "Pending";
  if (!["Pending", "Paid", "Cancelled"].includes(status))
    fail("Invalid invoice status");
  return {
    clientName: input.clientName.trim(),
    invoiceDate: input.invoiceDate,
    events,
    deliverables: Array.isArray(input.deliverables)
      ? input.deliverables.map((x) => String(x).slice(0, 1000)).slice(0, 50)
      : [],
    timeline: Array.isArray(input.timeline)
      ? input.timeline
          .slice(0, 50)
          .map((x) => ({
            deliverable: String(x.deliverable || "").slice(0, 1000),
            time: String(x.time || "").slice(0, 1000),
          }))
      : [],
    deliverablesPrice: deliverablesPrice / 100,
    discount: discount / 100,
    extraCharges: extraCharges / 100,
    advancePaid: advancePaid / 100,
    total: total / 100,
    status,
  };
}
module.exports = invoiceValues;
