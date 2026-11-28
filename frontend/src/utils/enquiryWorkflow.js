import { quotationStatus } from './quotationStatus.js';

const id = value => typeof value === 'object' ? value?._id : value;
export const enquiryProjectId = lead => id(lead?.studioProjectId) || '';
export const enquiryQuoteId = lead => id(lead?.quotationId) || '';

export function enquiryRemovalAction(lead) {
  const linked = enquiryProjectId(lead) || enquiryQuoteId(lead) || lead.tasks?.length || lead.cloudLink || lead.galleryTag ||
    Number(lead.depositAmount) > 0 || ['Deposit Paid', 'Paid'].includes(lead.paymentStatus);
  return linked ? (lead.status === 'Archived' ? '' : 'archive') : 'delete';
}

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

export function enquiryNextStep(lead, { canProject, canQuote, canUpdate = true, today }) {
  if (lead.status === 'Archived') return { description: 'This enquiry is archived.' };
  if (!canUpdate) {
    if (canProject && enquiryProjectId(lead)) return { action: 'project', description: 'Review this enquiry’s linked project.' };
    if (canQuote && enquiryQuoteId(lead)) return { action: 'quote', description: 'Review the quote linked to this enquiry.' };
    return { description: 'Review the client, event and follow-up details below.' };
  }
  if (lead.status === 'Converted') {
    return canProject ? { action: 'project', description: enquiryProjectId(lead) ? 'The booking is confirmed. Continue with the schedule, crew and delivery in its project.' : 'The enquiry is booked. Create its project to plan the shoot.' }
      : { description: 'This enquiry is booked.' };
  }

  const followUp = lead.followUpDate?.slice(0, 10);
  if (followUp && followUp <= today) return {
    action: 'followup', label: 'Review follow-up',
    description: followUp === today ? 'The follow-up is due today.' : 'The follow-up date has passed. Record the outcome or choose a new date.',
  };
  if (canQuote && enquiryQuoteId(lead)) {
    const savedQuote = typeof lead.quotationId === 'object' ? lead.quotationId : {};
    const status = savedQuote.status || lead.quotationStatus;
    const descriptions = {
      Draft: 'Review the draft quote before sharing it with the client.',
      Open: 'The quote is awaiting a response from the client.',
      Accepted: 'The client has accepted the quote. Review the booking details.',
      Expired: 'The quote has expired. Review it before discussing new terms.',
    };
    return { action: 'quote', description: descriptions[status && quotationStatus({ ...savedQuote, status })] || 'Review the quote linked to this enquiry.' };
  }
  if (canQuote && ['Meeting', 'Negotiation'].includes(lead.status)) return { action: 'quote', description: 'Use the event details to prepare a quote for the client.' };
  return followUp
    ? { action: 'followup', label: 'Review follow-up', description: 'A follow-up is scheduled.' }
    : { action: 'followup', label: 'Set follow-up', description: 'Choose when to get back to the client.' };
}
