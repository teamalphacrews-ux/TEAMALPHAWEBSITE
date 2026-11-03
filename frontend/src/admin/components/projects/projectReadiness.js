import { hasModuleAccess } from '../../../utils/moduleAccess.js';
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
