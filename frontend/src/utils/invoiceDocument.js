export const invoiceDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";
export function invoiceRows(i) {
  if (i.items?.length) return i.items;
  const r = (i.events || []).map((e) => ({
    title: e.eventName,
    description: [e.services, e.equipment, e.dateLocation]
      .filter(Boolean)
      .join("\n"),
    quantity: 1,
    unitPricePaise: Math.round(e.price * 100),
  }));
  if (i.deliverables?.length || i.deliverablesPrice)
    r.push({
      title: "Deliverables",
      description: (i.deliverables || []).join("\n"),
      quantity: 1,
      unitPricePaise: Math.round((i.deliverablesPrice || 0) * 100),
    });
  return r;
}
export async function downloadInvoice(i) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const studio = i.studio || {};
  const accent = /^#[a-f\d]{6}$/i.test(i.design?.accentColor || "")
    ? i.design.accentColor
    : "#1f2927";
  const paid =
    i.status === "Paid" ? Number(i.total) : Number(i.advancePaid || 0);
  let y = 20;
  const ensure = (height = 8) => {
    if (y + height > 275) {
      pdf.addPage();
      y = 20;
    }
  };
  const line = (value, size = 10, color = "#27313d", width = 174) => {
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    for (const chunk of pdf.splitTextToSize(String(value || ""), width)) {
      ensure(size * 0.5);
      pdf.text(chunk, 18, y);
      y += size * 0.5;
    }
    y += 3;
  };
  if (i.design?.showLogo !== false) {
    const response = await fetch(studio.logoUrl || "/team-alpha-logo.png");
    if (!response.ok) throw new Error("Logo could not be loaded");
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(bitmap.width, 600);
    canvas.height = Math.round((canvas.width * bitmap.height) / bitmap.width);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const width = Math.min(30, (20 * canvas.width) / canvas.height);
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      18,
      14,
      width,
      (width * canvas.height) / canvas.width,
    );
    bitmap.close();
  }
  pdf.setFontSize(23);
  pdf.setTextColor(accent);
  pdf.text("INVOICE", 192, 23, { align: "right" });
  pdf.setFontSize(10);
  pdf.text(i.documentNumber || "DRAFT", 192, 31, { align: "right" });
  y = 47;
  line(studio.name || "TEAM ALPHA", 14);
  for (const value of [
    studio.address,
    [studio.email, studio.phone].filter(Boolean).join(" | "),
    studio.website,
    studio.taxId && "GSTIN / Tax ID: " + studio.taxId,
  ])
    if (value) line(value, 9, "#647080");
  y += 5;
  line("BILL TO", 9, "#647080");
  line(i.clientName, 12);
  if (i.clientAddress) line(i.clientAddress, 9);
  line(
    "Issue date: " +
      invoiceDate(i.invoiceDate) +
      "    |    Due date: " +
      invoiceDate(i.dueDate),
    9,
  );
  if (i.title) {
    y += 5;
    line(i.title, 14);
  }
  y += 5;
  const header = () => {
    ensure(15);
    pdf.setFillColor("#f3f5f7");
    pdf.rect(18, y - 5, 174, 10, "F");
    pdf.setFontSize(8);
    pdf.setTextColor("#647080");
    pdf.text("ITEM / DESCRIPTION", 21, y);
    pdf.text("QTY", 126, y);
    pdf.text("PRICE", 156, y, { align: "right" });
    pdf.text("AMOUNT", 190, y, { align: "right" });
    y += 12;
  };
  header();
  for (const item of invoiceRows(i)) {
    if (y > 247) {
      pdf.addPage();
      y = 20;
      header();
    }
    const rowY = y;
    pdf.setFontSize(9);
    pdf.setTextColor("#27313d");
    pdf.text(String(item.quantity), 128, rowY);
    pdf.text("INR " + (item.unitPricePaise / 100).toFixed(2), 156, rowY, {
      align: "right",
    });
    pdf.text(
      "INR " + ((item.quantity * item.unitPricePaise) / 100).toFixed(2),
      190,
      rowY,
      { align: "right" },
    );
    line(item.title || "Service", 10, "#27313d", 100);
    if (item.description) line(item.description, 9, "#647080", 100);
    y += 5;
    pdf.setDrawColor("#e3e7ed");
    pdf.line(18, y - 3, 192, y - 3);
  }
  y += 5;
  const subtotal = invoiceRows(i).reduce(
    (sum, item) => sum + (item.quantity * item.unitPricePaise) / 100,
    0,
  );
  for (const [label, value] of [
    ["Subtotal", subtotal],
    ["Discount", -Number(i.discount || 0)],
    ["Tax", Number(i.taxAmount || 0)],
    ["Extra charges", Number(i.extraCharges || 0)],
    ["Total", Number(i.total)],
    ["Paid", paid],
    ["Balance due", Math.max(0, i.total - paid)],
  ]) {
    ensure(10);
    pdf.setFontSize(label === "Balance due" ? 12 : 10);
    pdf.setTextColor(label === "Balance due" ? accent : "#27313d");
    pdf.text(label, 115, y);
    pdf.text("INR " + value.toFixed(2), 192, y, { align: "right" });
    y += 9;
  }
  if (i.paymentScheduleEnabled) {
    y += 6;
    line("Payment schedule", 12);
    for (const [index, payment] of (i.paymentSchedule || []).entries())
      line(
        "Payment " +
          (index + 1) +
          ": INR " +
          (payment.amountPaise / 100).toFixed(2) +
          " due " +
          invoiceDate(payment.dueDate),
        9,
      );
  }
  for (const [label, value] of [
    ["Notes", i.notes],
    ["Terms", i.terms],
    ["Payment instructions", studio.paymentInstructions],
    ["Bank details", studio.bankDetails],
    ["UPI ID", studio.upiId],
  ]) {
    if (value) {
      y += 6;
      ensure(18);
      line(label, 11);
      line(value, 9);
    }
  }
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor("#8a929e");
    pdf.text(
      (studio.name || "Team Alpha") + " · " + page + " / " + count,
      105,
      289,
      { align: "center" },
    );
  }
  pdf.save(
    (i.documentNumber || "Team-Alpha-Invoice").replace(/[^a-z0-9_-]/gi, "-") +
      ".pdf",
  );
}
