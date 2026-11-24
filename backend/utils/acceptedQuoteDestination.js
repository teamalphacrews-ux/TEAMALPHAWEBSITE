const { currentWorkspace } = require('../saas/tenantContext');

function acceptedQuoteDestination(quote, legacyLink) {
  if (!currentWorkspace()) return legacyLink;
  // Acceptance reserves an ID before the draft is written. Only a completed
  // generation can open the invoice directly; interrupted runs open the quote.
  return quote.invoiceId && quote.invoiceGeneratedAt
    ? '/admin/invoices/' + quote.invoiceId
    : '/admin/quotations?quote=' + quote._id;
}

module.exports = { acceptedQuoteDestination };
