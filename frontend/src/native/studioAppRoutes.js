// The app displays these existing Studio OS routes, including their nested editors.
export const STUDIO_APP_MODULES = [
  { group: 'Workspace', title: 'Overview', path: '/admin' },
  { group: 'Workspace', title: 'Enquiries', path: '/admin/crm' },
  { group: 'Workspace', title: 'Projects', path: '/admin/studio-projects' },
  { group: 'Workspace', title: 'Quotations', path: '/admin/quotations' },
  { group: 'Workspace', title: 'Contacts', path: '/admin/contacts' },
  { group: 'Workspace', title: 'Shoot day', path: '/admin/shoot-day' },
  { group: 'Workspace', title: 'Calendar', path: '/admin/calendar' },
  { group: 'Workspace', title: 'Finance', path: '/admin/finance' },
  { group: 'Operations', title: 'Crew & scheduling', path: '/admin/crew' },
  { group: 'Operations', title: 'Post production', path: '/admin/post-production' },
  { group: 'Communication', title: 'Client support', path: '/admin/chats' },
  { group: 'Communication', title: 'Email', path: '/admin/email' },
  { group: 'Communication', title: 'WhatsApp', path: '/admin/whatsapp' },
  { group: 'Studio', title: 'Offline drafts', path: '/admin/offline-drafts' },
  { group: 'Studio', title: 'Data & backups', path: '/admin/data' },
  { group: 'Studio', title: 'Activity', path: '/admin/activity-log' },
  { group: 'Studio', title: 'Integrations', path: '/admin/integrations' },
  { group: 'Studio', title: 'Team & access', path: '/admin/users' },
  { group: 'Studio', title: 'Workspace & plan', path: '/admin/workspace' },
  { group: 'Studio', title: 'Settings', path: '/admin/settings' },
];

export const STUDIO_APP_SETTINGS = [
  ['workspace', 'My workspace'], ['language', 'Language & region'],
  ['notifications', 'Sound & notifications'], ['device','App & device'], ['profile', 'Studio profile'],
  ['branding', 'Brand & documents'], ['billing', 'Billing & payments'],
  ['automation', 'Reminders & alerts'], ['communication', 'Email & messages'],
  ['production', 'Production templates'], ['client', 'Client smart links'],
  ['connections', 'Connections'], ['security', 'Security & access'],
  ['backups', 'Backups & recovery'],
].map(([id, title]) => ({ id, title, path: '/admin/settings?section=' + id }));

export function appPreviewDestination(value) {
  if (typeof value !== 'string' || value.length > 600 || /[\\\s]/.test(value) || [...value].some(character => character.charCodeAt(0) < 32) || /%2f|%5c/i.test(value) || !value.startsWith('/admin')) return null;
  try {
    const url = new URL(value, 'http://studio-preview.invalid');
    if (url.origin !== 'http://studio-preview.invalid' || !/^\/admin(?:\/|$)/.test(url.pathname)) return null;
    const match = STUDIO_APP_MODULES.some(item => url.pathname === item.path || (item.path !== '/admin' && url.pathname.startsWith(item.path + '/')));
    if (!match && !/^\/admin\/(?:invoices|subscription|quote-templates|projects)(?:\/|$)/.test(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
