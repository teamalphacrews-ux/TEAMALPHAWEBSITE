const test = require('node:test');
const assert = require('node:assert/strict');
const { auditLinkedReceipts } = require('../scripts/auditLinkedReceipts');
const id = index => index.toString(16).padStart(24, '0');

test('linked receipts are potential overlap once per booking, with unresolved links reported separately', () => {
  const bookings = [{ _id: id(10), paymentStatus: 'Deposit Paid', totalAmount: 500, depositAmount: 100 }];
  const invoice = (i, values) => ({ _id: id(i), leadId: id(10), status: 'Pending', documentStatus: 'Sent', total: 150, ...values });
  const invoices = [
    invoice(1, { advancePaid: 60 }), invoice(2, { status: 'Paid', total: 70 }),
    invoice(3, { leadId: null, advancePaid: 4 }), invoice(4, { leadId: id(99), advancePaid: 5 }),
    invoice(5, { documentStatus: 'Draft', advancePaid: 100 }), invoice(6, { status: 'Cancelled', advancePaid: 100 }),
    invoice(7, { currency: 'USD', advancePaid: 2 }),
  ];
  assert.deepEqual(auditLinkedReceipts({ bookings, invoices }), {
    candidateBookings: 1, candidateInvoices: 2, candidateBookingPaidPaise: 10000,
    candidateInvoicePaidPaise: 13000, maximumPossibleOverlapPaise: 10000,
    missingBookingLinkInvoices: 1, missingBookingRecordInvoices: 1, unresolvedInvoicePaidPaise: 900,
    excludedForeignCurrencyInvoices: 1,
  });
  assert.throws(() => auditLinkedReceipts({ bookings, invoices: [...invoices, invoices[0]] }), /Duplicate invoice/);
});
