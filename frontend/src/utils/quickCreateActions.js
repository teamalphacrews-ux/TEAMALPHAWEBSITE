import { canAccessStudioPath, hasModuleAccess, moduleForStudioPath } from './moduleAccess.js';

import { canWriteWorkspaceModule } from './workspaceActions.js';

const originalActions = [
  ['enquiry', 'Enquiry', '/admin/crm?new=1'],
  ['quote', 'Quotation', '/admin/quotations?new=1'],
  ['invoice', 'Invoice', '/admin/invoices/new'],
  ['expense', 'Expense', '/admin/finance?view=ledger&new=expense'],
  ['event', 'Shoot', '/admin/calendar?new=1'],
];

function destination(path, fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value) params.set(key, value);
  }
  return params.size ? path + '?' + params : path;
}

export function quickCreateActions(user, { commercial, contactId, projectId }) {
  if (!commercial) return originalActions.filter(([, , path]) => canAccessStudioPath(user, path));
  const contact = hasModuleAccess(user, 'contacts') ? contactId : undefined;
  const project = hasModuleAccess(user, 'projects') ? projectId : undefined;
  const actions = [
    originalActions[0],
    ['client', 'Client profile', '/admin/contacts?new=1'],
    ['project', 'Project', destination('/admin/studio-projects', { new: '1', contact })],
    ['quote', 'Quote', destination('/admin/quotations', { new: contact ? undefined : '1', contact, project })],
    ['invoice', 'Invoice', destination('/admin/invoices/new', { contact, project })],
    ['task', 'Task', destination('/admin/post-production', { new: '1', studioProject: project })],
    ['event', 'Calendar event', destination('/admin/calendar', { new: '1', contact, project })],
    originalActions[3],
  ];
  return actions.filter(([key, , path]) =>
    canWriteWorkspaceModule(user, moduleForStudioPath(path)) && (key !== 'project' || hasModuleAccess(user, 'contacts')),
  );
}
