// Read ONE studio's offline, projected fixture from stdin. No database or network access.
// JSON: { "bookings": [{ "_id", "paymentStatus", "depositAmount", "totalAmount" }],
//         "invoices": [{ "_id", "leadId", "currency", "documentStatus", "status", "advancePaid", "total" }] }
// Output contains aggregate counts/paise only. Every candidate still needs independent payment evidence.
const fs = require('node:fs');

function amountPaise(value) {
  if (value == null) return 0;
  const paise = Math.round(value * 100);
  if (typeof value !== 'number' || !Number.isSafeInteger(paise) || paise < 0 || paise / 100 !== value) {
    throw new Error('Expected a nonnegative INR amount with at most two decimals.');
  }
  return paise;
}

function recordId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) throw new Error('Expected a 24-digit hexadecimal record ID.');
  return value.toLowerCase();
}

function addPaise(left, right) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new Error('Combined paise exceed the supported integer range.');
  return sum;
}

function auditLinkedReceipts(input) {
  if (!Array.isArray(input?.bookings) || !Array.isArray(input?.invoices)) {
    throw new Error('Supply bookings and invoices arrays for a single studio.');
  }
  const bookings = new Map(), seenInvoices = new Set();
  for (const booking of input.bookings) {
    const id = recordId(booking._id);
    if (bookings.has(id)) throw new Error('Duplicate booking ID in input.');
    const paid = booking.paymentStatus === 'Paid' ? amountPaise(booking.totalAmount)
      : booking.paymentStatus === 'Deposit Paid' ? amountPaise(booking.depositAmount) : 0;
    bookings.set(id, { paid, invoiceCount: 0, invoicePaise: 0 });
  }
  const summary = {
    candidateBookings: 0, candidateInvoices: 0, candidateBookingPaidPaise: 0,
    candidateInvoicePaidPaise: 0, maximumPossibleOverlapPaise: 0,
    missingBookingLinkInvoices: 0, missingBookingRecordInvoices: 0, unresolvedInvoicePaidPaise: 0,
    excludedForeignCurrencyInvoices: 0,
  };
  for (const invoice of input.invoices) {
    const id = recordId(invoice._id);
    if (seenInvoices.has(id)) throw new Error('Duplicate invoice ID in input.');
    seenInvoices.add(id);
    if (['Draft', 'Cancelled', 'Archived'].includes(invoice.documentStatus) || invoice.status === 'Cancelled') continue;
    if (invoice.currency && invoice.currency !== 'INR') {
      summary.excludedForeignCurrencyInvoices++;
      continue;
    }
    const total = amountPaise(invoice.total);
    const paid = invoice.status === 'Paid' ? total : Math.min(total, amountPaise(invoice.advancePaid));
    if (!paid) continue;
    const booking = invoice.leadId == null ? null : bookings.get(recordId(invoice.leadId));
    if (!booking) {
      if (invoice.leadId == null) summary.missingBookingLinkInvoices++;
      else summary.missingBookingRecordInvoices++;
      summary.unresolvedInvoicePaidPaise = addPaise(summary.unresolvedInvoicePaidPaise, paid);
    } else if (booking.paid > 0) {
      booking.invoiceCount++;
      booking.invoicePaise = addPaise(booking.invoicePaise, paid);
    }
  }
  for (const booking of bookings.values()) {
    if (!booking.invoiceCount) continue;
    summary.candidateBookings++;
    summary.candidateInvoices += booking.invoiceCount;
    summary.candidateBookingPaidPaise = addPaise(summary.candidateBookingPaidPaise, booking.paid);
    summary.candidateInvoicePaidPaise = addPaise(summary.candidateInvoicePaidPaise, booking.invoicePaise);
    summary.maximumPossibleOverlapPaise = addPaise(summary.maximumPossibleOverlapPaise, Math.min(booking.paid, booking.invoicePaise));
  }
  return summary;
}

if (require.main === module) {
  try {
    const summary = auditLinkedReceipts(JSON.parse(fs.readFileSync(0, 'utf8')));
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } catch {
    // Parser errors may contain the input itself; keep diagnostics free of record values.
    console.error('Invalid fixture. Supply a single studio projection with unique record IDs and valid INR amounts.');
    process.exitCode = 1;
  }
}
module.exports = { auditLinkedReceipts };
