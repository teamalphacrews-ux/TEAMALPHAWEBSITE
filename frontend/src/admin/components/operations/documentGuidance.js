const recordId = value => String(value?._id || value || '');

export function projectIncludesClient(project, clientId) {
  return Boolean(clientId) && [project.contactId, ...(project.additionalClients || [])]
    .some(value => recordId(value) === clientId);
}

export function documentClientContext(search, projects, contacts) {
  const project = projects.find(row => recordId(row) === search.get('project'));
  const requestedContact = search.get('contact');
  const clientId = requestedContact || recordId(project?.contactId);
  const contact = contacts.find(row => recordId(row) === clientId);
  return {
    contact,
    projectId: project && (!requestedContact || projectIncludesClient(project, requestedContact)) ? recordId(project) : '',
  };
}

export function quoteNextStep({ status, totalPaise, hasInvoice, canSeeInvoices, canShare, editing, linkRevoked, invoicePending, readOnly }) {
  if (status === 'Accepted') {
    if (!canSeeInvoices) return { title: 'Quote accepted', detail: 'Your studio can continue with billing.' };
    if (invoicePending) return { title: 'Invoice preparation pending', detail: 'Reopen this quote to check when the invoice is ready.' };
    return hasInvoice
      ? { title: 'Review the linked invoice', detail: 'Check its issue status and payment schedule.', action: 'invoice', label: 'Review invoice' }
      : { title: 'Review billing', detail: 'This accepted quote has no linked invoice. Check the invoice register before preparing one.', action: 'register', label: 'Check invoices' };
  }
  if (['Cancelled', 'Declined', 'Archived'].includes(status)) return { title: 'Quote closed', detail: 'You can refer back to the terms and the client’s decision.' };
  if (status === 'Expired') return { title: 'Review the acceptance deadline', detail: 'Confirm the dates and terms with the client before offering a fresh quote.' };
  if (status === 'Open' && linkRevoked) return { title: 'Client link revoked', detail: canShare ? 'To invite the client back, regenerate their smart link from Actions.' : 'Your studio can prepare a new client link if needed.' };
  if (status === 'Open') return { title: 'Awaiting the client’s decision', detail: 'Follow up if needed. Their acceptance will appear on this quote.' };
  if (readOnly) return { title: 'Review the draft', detail: 'Check the coverage, total and terms. Your studio can share the quote when it is ready.' };
  if (editing && totalPaise <= 0) return { title: 'Review your coverage and prices', detail: 'Set the services and rates the client will see.', action: 'price', label: 'Review pricing' };
  return { title: 'Preview the quote', detail: canShare ? 'Check the coverage, total and terms before sharing the client link.' : 'Check the coverage, total and terms before your studio shares it.' };
}

export function invoiceNextStep(invoice, totalPaise, readOnly = false) {
  if (invoice.documentStatus === 'Cancelled' || invoice.status === 'Cancelled') return { title: 'Invoice cancelled', detail: 'There is no payment to collect on this invoice.' };
  if (invoice.documentStatus === 'Draft') {
    if (readOnly) return { title: 'Awaiting studio review', detail: 'An authorised team member can check this draft and issue it.' };
    if (!invoice.clientName?.trim()) return { title: 'Choose the client', detail: 'Select an existing client or enter their billing details.', action: 'client', label: 'Client details' };
    if (!invoice.items?.some(item => item.title?.trim() || item.description?.trim()) || totalPaise <= 0) return { title: 'Review the invoice items', detail: 'Check services, quantities and rates before issuing.', action: 'items', label: 'Review items' };
    return { title: 'Review before issue', detail: 'Check the amount and payment dates, then choose Approve & issue.' };
  }
  const balancePaise = totalPaise - Math.round(Number(invoice.advancePaid || 0) * 100);
  if (invoice.status === 'Paid' || balancePaise <= 0) return { title: 'No balance left to collect', detail: 'The invoice is available for your records.' };
  if (readOnly) return { title: 'Awaiting payment', detail: 'Your studio can record the receipt when the payment arrives.' };
  if (invoice.linkRevokedAt) return { title: 'Invoice link revoked', detail: 'To share this invoice again, regenerate its link from Actions.' };
  if (invoice.sourceQuotation || invoice.sharedAt || invoice.scheduledDelivery?.state === 'scheduled') {
    return { title: 'Track the outstanding balance', detail: 'Check the amount received when the client makes a payment.', action: 'balance', label: 'Review payments' };
  }
  return { title: 'Share the issued invoice', detail: 'Use Share link or email the invoice from Actions.' };
}
