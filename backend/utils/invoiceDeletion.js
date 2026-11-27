// Evaluate the same conditions inside Recovery's transaction on every entry point.
function deletableInvoiceFilter(id) {
  return {
    _id: id,
    documentStatus: 'Draft',
    approvedAt: null,
    status: { $nin: ['Paid', 'Cancelled'] },
    advancePaid: { $not: { $gt: 0 } },
    sourceQuotation: null,
    sharedAt: null,
  };
}

module.exports = { deletableInvoiceFilter };
