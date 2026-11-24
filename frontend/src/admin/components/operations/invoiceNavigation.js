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

// A newly saved draft keeps its editor while its URL changes to the server ID.
// Every other record, creation context and workspace gets an isolated editor.
export function invoiceEditorKey(scope, id, location, promotion) {
  if (id && promotion?.scope === scope && promotion.id === id && !location.search) return promotion.key;
  return JSON.stringify(id ? [scope, 'record', id] : [scope, 'new', location.key, location.search]);
}

export async function loadInvoiceRecord(id, request) {
  const invoice = await request('get', '/api/invoices/' + encodeURIComponent(id));
  if (!invoice || String(invoice._id) !== id) throw new Error('The requested invoice could not be verified.');
  return invoice;
}
