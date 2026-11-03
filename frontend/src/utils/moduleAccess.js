export const STUDIO_MODULE_GROUPS = [
  { label: 'Studio work', modules: [['overview', 'Overview'], ['enquiries', 'Enquiries'], ['projects', 'Projects & orders'], ['contacts', 'Contacts'], ['calendar', 'Calendar & shoot day']] },
  { label: 'Documents & money', modules: [['quotations', 'Quotations & templates'], ['invoices', 'Invoices'], ['finance', 'Finance & payments']] },
  { label: 'Production', modules: [['crew', 'Crew & scheduling'], ['production', 'Post production'], ['galleries', 'Galleries & delivery links']] },
  { label: 'Communication', modules: [['support', 'Client support'], ['email', 'Email'], ['whatsapp', 'WhatsApp']] },
  { label: 'Administration', modules: [['team', 'Team & access'], ['settings', 'Settings'], ['data', 'Data & backups'], ['activity', 'Activity'], ['integrations', 'Integrations']] },
];
export const STUDIO_MODULE_IDS = STUDIO_MODULE_GROUPS.flatMap(group => group.modules.map(([id]) => id));
export const hasFullModuleAccess = user => Boolean(user && (user.studioOwner === true || user.owner === true || user.moduleAccess == null));
export const hasModuleAccess = (user, module) => Boolean(user && (hasFullModuleAccess(user) || (Array.isArray(user.moduleAccess) && user.moduleAccess.includes(module))));
export const canManageTeam = user => Boolean(user && (user.canManageTeam === true || hasModuleAccess(user, 'team')));
export const permittedModules = user => STUDIO_MODULE_IDS.filter(id => hasModuleAccess(user, id));
const routeModules = {
  invoices: 'invoices', 'quote-templates': 'quotations', templates: 'quotations', 'studio-projects': 'projects', projects: 'projects', crm: 'enquiries', quotations: 'quotations', contacts: 'contacts', clients: 'contacts', finance: 'finance', calendar: 'calendar', 'shoot-day': 'calendar', crew: 'crew', 'post-production': 'production', chats: 'support', email: 'email', whatsapp: 'whatsapp', settings: 'settings', data: 'data', 'offline-drafts': 'data', 'activity-log': 'activity', integrations: 'integrations', users: 'team', workspace: 'settings', subscription: 'settings', gallery: 'galleries',
};
export function moduleForStudioPath(path) {
  const pathname = String(path || '').split(/[?#]/)[0].replace(/\/$/, '');
  if (pathname === '/admin') return 'overview';
  if (/^\/quote-preview(?:\/|$)/.test(pathname)) return 'quotations';
  return routeModules[pathname.match(/^\/admin\/([^/]+)/)?.[1]] || null;
}
export function canAccessStudioPath(user, path) {
  if (String(path || '').split(/[?#]/)[0].replace(/\/$/, '') === '/admin') return Boolean(user);
  if (String(path || '').split(/[?#]/)[0].replace(/\/$/, '') === '/admin/projects') return hasModuleAccess(user, 'projects') && hasModuleAccess(user, 'enquiries');
  const module = moduleForStudioPath(path);
  return module ? hasModuleAccess(user, module) : false;
}
export function canEditTeamMember(manager, member) {
  const managerId = String(manager?._id || manager?.id || ''), memberId = String(member?._id || member?.id || '');
  if (!canManageTeam(manager) || !memberId || managerId === memberId || member.studioOwner === true || member.owner === true) return false;
  return hasFullModuleAccess(manager) || (Array.isArray(member.moduleAccess) && member.moduleAccess.every(module => hasModuleAccess(manager, module)));
}
