import { hasModuleAccess } from '../../../utils/moduleAccess.js';
import { canWriteWorkspaceModule } from '../../../utils/workspaceActions.js';
import { quotationStatus } from '../../../utils/quotationStatus.js';

export function clientNextAction(user, { contact, invoices = [], quotations = [], projects = [] }, now) {
  if (!contact?._id || contact.archived || contact.contactType === 'Other') return null;
  const linkedToClient = record => record?._id && (record.contactId?._id || record.contactId) === contact._id;

  if (canWriteWorkspaceModule(user, 'invoices', now)) {
    const draft = invoices.find(invoice => linkedToClient(invoice) && invoice.documentStatus === 'Draft' && !['Cancelled', 'Paid'].includes(invoice.status));
    if (draft) return {
      message: draft.invoiceNumber || draft.documentNumber ? `Invoice ${draft.invoiceNumber || draft.documentNumber} is ready to review.` : 'Review the draft invoice before you issue it.',
      label: 'Review draft invoice',
      to: '/admin/invoices/' + encodeURIComponent(draft._id),
    };
  }
  if (canWriteWorkspaceModule(user, 'quotations', now)) {
    const draft = quotations.find(quote => linkedToClient(quote) && quotationStatus(quote, now) === 'Draft');
    if (draft) return {
      message: draft.title ? `Finish the draft for “${draft.title}”.` : 'Finish this client’s draft quote.',
      label: 'Continue quote',
      to: '/admin/quotations?' + new URLSearchParams({ quote: draft._id }),
    };
  }
  if (!hasModuleAccess(user, 'projects')) return null;
  const active = projects.filter(project => project?._id && ['Inquiry', 'Booked'].includes(project.status));
  if (active.length === 1) return {
    message: active[0].name || 'Continue the active project.',
    label: 'Open project',
    to: '/admin/studio-projects/' + encodeURIComponent(active[0]._id),
  };
  if (active.length > 1) return { message: 'Choose a project below to see its next step.' };
  if (!projects.length && canWriteWorkspaceModule(user, 'projects', now)) return {
    message: 'Start a project to keep this booking’s dates, crew and documents together.',
    label: 'Create project',
  };
  return null;
}
