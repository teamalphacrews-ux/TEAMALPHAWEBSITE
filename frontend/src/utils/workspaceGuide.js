// Each destination points to a section of the same guide available on the website.
const pageGuides = {
  '': 'getting-started#orient',
  crm: 'enquiries#capture',
  contacts: 'contacts#create-contact',
  clients: 'contacts#create-contact',
  'studio-projects': 'projects-crew#project-setup',
  projects: 'projects-crew#coordinate',
  gallery: 'projects-crew#coordinate',
  quotations: 'quotations#setup',
  templates: 'quotations#templates',
  'quote-templates': 'quotations#templates',
  invoices: 'invoices#draft',
  finance: 'finance#views',
  crew: 'projects-crew#coordinate',
  calendar: 'calendar-shoot-day#calendar',
  'shoot-day': 'calendar-shoot-day#shoot-day',
  'post-production': 'post-production-delivery#tasks',
  chats: 'client-support#find-thread',
  email: 'email#connect',
  whatsapp: 'whatsapp#identify-route',
  settings: 'studio-settings#identity-documents',
  data: 'backups#create',
  'offline-drafts': 'offline-drafts-activity#drafts',
  'activity-log': 'offline-drafts-activity#activity',
  integrations: 'integrations-ai#readiness',
  users: 'team-access#accounts',
  workspace: 'team-access#workspace',
  subscription: 'team-access#plan',
};

const settingsGuides = {
  workspace: 'overview-appearance#appearance',
  automation: 'studio-settings#automation',
  billing: 'studio-settings#billing-visibility',
  client: 'client-smart-link#prepare',
  backups: 'backups#create',
  production: 'post-production-delivery#templates',
  connections: 'integrations-ai#readiness',
};

export function workspaceGuideTarget(pathname, search = '') {
  const [, root, page = '', record] = pathname.split('/');
  if (root !== 'admin' || !Object.hasOwn(pageGuides, page)) return null;
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (page === 'settings' && Object.hasOwn(settingsGuides, params.get('section'))) return settingsGuides[params.get('section')];
  if (page === 'crm' && params.has('lead')) return 'enquiries#follow-through';
  if (page === 'contacts' && record) return 'contacts#maintain-profile';
  if (page === 'studio-projects' && record) {
    if (tab === 'payments') return 'payment-schedules#receipts';
    if (tab === 'delivery') return 'post-production-delivery#publish';
    if (tab === 'documents') return 'client-smart-link#prepare';
    return 'projects-crew#coordinate';
  }
  if (page === 'quotations' && params.has('quote')) return 'quotations#review-share';
  if (page === 'finance' && params.get('view') === 'ledger') return 'finance#transactions';
  if (page === 'chats' && params.has('quote')) return 'client-support#reply';
  if (page === 'whatsapp' && params.has('conversation')) return 'whatsapp#send-review';
  if (page === 'email' && params.get('gmail') === 'connected') return 'email#read';
  if (['workspace', 'subscription', 'users'].includes(page)) {
    if (tab === 'team') return 'team-access#accounts';
    if (tab === 'subscription') return 'team-access#plan';
    if (tab === 'overview') return 'team-access#workspace';
  }
  return pageGuides[page];
}
