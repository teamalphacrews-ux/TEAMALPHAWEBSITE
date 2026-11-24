import { canWriteWorkspaceModule } from '../../../utils/workspaceActions.js';
import { hasModuleAccess } from '../../../utils/moduleAccess.js';
import { quotationStatus } from '../../../utils/quotationStatus.js';
import { studioDayKey } from '../../../utils/studioTime.js';
import { contactPaymentTotals } from '../contacts/contactPaymentTotals.js';
import { recordId } from '../../../utils/projectWorkspace.js';

export function projectReadinessActions(detail, user) {
  const { project, sessions = [], production = {} } = detail;
  const actions = [];
  if (hasModuleAccess(user, 'calendar') && !sessions.length) actions.push({
    key: 'schedule', label: 'No session scheduled', action: 'Schedule a session',
    href: '/admin/calendar?' + new URLSearchParams({ contact: recordId(project.contactId), project: recordId(project) }),
  });
  // Crew and checklist creation require the project's existing linked enquiry.
  // Avoid offering a write path while that production connection is unavailable.
  if (production.lead && hasModuleAccess(user, 'crew') && !(production.crew || []).length) actions.push({
    key: 'crew', label: 'Crew not assigned', action: 'Assign crew', tab: 'crew',
  });
  if (production.lead && hasModuleAccess(user, 'production') && !(production.tasks || []).length) actions.push({
    key: 'checklist', label: 'Checklist not started', action: 'Prepare checklist', tab: 'delivery',
  });
  return actions;
}

export function projectChecklistSummary(tasks = []) {
  return tasks.length
    ? { value: tasks.filter(task => task.status === 'completed').length + ' / ' + tasks.length, label: 'Tasks complete' }
    : { value: 'Not started', label: 'Checklist' };
}

export function projectNextStep(detail, user, { now = new Date(), timezone } = {}) {
  const { project, quotations = [], invoices = [], production = {} } = detail;
  if (project.status === 'Archived') return { label: 'This project is archived.' };

  if (hasModuleAccess(user, 'invoices')) {
    const invoice = invoices.find(row => row._id && contactPaymentTotals([row], now).pastDue > 0);
    if (invoice) return { label: 'A payment on this project is overdue.', action: 'Review invoice', href: '/admin/invoices/' + encodeURIComponent(invoice._id) };
    const draft = invoices.find(row => row._id && row.documentStatus === 'Draft' && !['Cancelled', 'Paid'].includes(row.status));
    if (draft) return { label: 'A draft invoice is ready for review.', action: 'Review draft invoice', href: '/admin/invoices/' + encodeURIComponent(draft._id) };
  }

  if (project.status === 'Completed') return { label: 'This project is complete.' };
  if (project.status === 'Inquiry' && hasModuleAccess(user, 'quotations')) {
    const quote = quotations.find(row => row._id && !['Archived', 'Cancelled', 'Declined'].includes(row.status));
    if (quote) {
      const status = quotationStatus(quote, now);
      const copy = {
        Draft: 'Your quote is in draft. Review coverage and pricing before sharing.',
        Open: 'The quote is awaiting a response from the client.',
        Accepted: 'The client accepted the quote. Check the booking details.',
        Expired: 'The quote has expired. Review it before agreeing new dates.',
      };
      const label = canWriteWorkspaceModule(user, 'quotations', now)
        ? copy[status] || 'Review the linked quote.'
        : 'Review the quote linked to this project.';
      return { label, action: 'Open quote', href: '/admin/quotations?' + new URLSearchParams({ quote: quote._id }) };
    }
    if (recordId(project.contactId) && canWriteWorkspaceModule(user, 'quotations', now)) return {
      label: 'Prepare a quote using this project and its client details.', action: 'Prepare quote',
      href: '/admin/quotations?' + new URLSearchParams({ contact: recordId(project.contactId), project: recordId(project) }),
    };
  }

  const pending = production.lead && hasModuleAccess(user, 'production')
    ? (production.tasks || []).filter(task => task._id && task.status !== 'completed')
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0]
    : null;
  const due = pending?.dueDate?.slice(0, 10);
  const today = studioDayKey(now, timezone);
  const taskStep = pending && {
    label: due && due < today ? 'Overdue task · ' + pending.title : due === today ? 'Due today · ' + pending.title : 'Next task · ' + pending.title,
    ...(canWriteWorkspaceModule(user, 'production', now)
      ? { action: 'Open task', href: '/admin/post-production?' + new URLSearchParams({ task: pending._id }) }
      : { action: 'View checklist', tab: 'delivery' }),
  };
  if (taskStep && due && due <= today) return taskStep;
  const next = projectReadinessActions(detail, user).find(step => {
    if (step.key === 'schedule') return recordId(project.contactId) && canWriteWorkspaceModule(user, 'calendar', now);
    // Team assignments PATCH the project. Production tasks use a separate API.
    if (step.key === 'crew') return canWriteWorkspaceModule(user, 'projects', now);
    return canWriteWorkspaceModule(user, 'production', now);
  });
  return next || taskStep || { label: 'No next action is due in your project view.' };
}
