const recordId = (value) => String(value?._id || value || "");
export function invoiceForLead(invoices, lead) {
  const found = invoices.find(
    (invoice) =>
      (invoice.leadId && recordId(invoice.leadId) === recordId(lead._id)) ||
      (invoice.studioProjectId &&
        lead.studioProjectId &&
        recordId(invoice.studioProjectId) === recordId(lead.studioProjectId)) ||
      (invoice.sourceQuotation &&
        lead.quotationId &&
        recordId(invoice.sourceQuotation) === recordId(lead.quotationId)),
  );
  if (found) return found;
  const legacy = invoices.filter(
    (invoice) =>
      !invoice.leadId &&
      !invoice.studioProjectId &&
      invoice.clientName === lead.name &&
      (!invoice.clientEmail || invoice.clientEmail === lead.email),
  );
  return legacy.length === 1 ? legacy[0] : null;
}
export function invoiceDestination(invoices, lead) {
  const invoice = invoiceForLead(invoices, lead);
  if (invoice) return `/admin/invoices/${invoice._id}`;
  const params = new URLSearchParams({ lead: recordId(lead._id) });
  if (lead.contactId) params.set("contact", recordId(lead.contactId));
  if (lead.studioProjectId)
    params.set("project", recordId(lead.studioProjectId));
  return `/admin/invoices/new?${params}`;
}
