const id = value => typeof value === 'object' ? value?._id : value;
export const enquiryProjectId = lead => id(lead?.studioProjectId) || '';
export const enquiryQuoteId = lead => id(lead?.quotationId) || '';
export function enquiryProjectDestination(project) {
  const projectId = id(project);
  if (!projectId) throw new Error('The enquiry project could not be prepared. Please retry.');
  return '/admin/studio-projects/' + encodeURIComponent(projectId);
}
export function enquiryQuoteDestination({ lead, project }) {
  const quotationId = enquiryQuoteId(lead);
  if (quotationId) return '/admin/quotations?' + new URLSearchParams({ quote: quotationId });
  const contactId = id(project?.contactId), projectId = id(project);
  if (!contactId || !projectId) throw new Error('The enquiry’s client and project connection needs review.');
  return '/admin/quotations?' + new URLSearchParams({ contact: contactId, project: projectId });
}
