import { LayoutDashboard, UsersRound, Wallet, CalendarDays, MessageSquare, Bell, Folder, Clapperboard, Webhook, FileText, ReceiptText, HardDrive, UserRound, Mail, MessageCircle, Layers3 } from 'lucide-react';
import { canAccessStudioPath } from '../../../utils/moduleAccess';
import { IS_COMMERCIAL_DEPLOYMENT, SAAS_RELEASE_ENABLED } from '../../../saas/release';

// Both dashboard URLs are valid entry points. Use the mounted form so NavLink's
// exact match sets aria-current on the dashboard without matching its subpages.
export function workspaceNavTarget(path, pathname) {
  return IS_COMMERCIAL_DEPLOYMENT && path === '/admin' && pathname === '/admin/' ? pathname : path;
}

export const workspaceIconTones = {
  '/admin': 'blue', '/admin/crm': 'cyan', '/admin/studio-projects': 'indigo',
  '/admin/quotations': 'amber', '/admin/contacts': 'slate', '/admin/calendar': 'rose',
  '/admin/finance': 'green', '/admin/invoices': 'green', '/admin/quote-templates': 'amber', '/admin/projects': 'indigo',
  '/admin/crew': 'cyan', '/admin/post-production': 'violet', '/admin/data': 'slate',
  '/admin/chats': 'blue', '/admin/activity-log': 'rose', '/admin/integrations': 'violet',
  '/admin/settings': 'slate', '/admin/users': 'cyan',
  '/admin/email': 'rose',
  '/admin/whatsapp': 'green',
};
export const workspacePrimaryItems = [
  { name: "Overview", path: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Enquiries", path: "/admin/crm", icon: MessageSquare },
  { name: "Projects", path: "/admin/studio-projects", icon: Folder },
  { name: "Quotations", path: "/admin/quotations", icon: FileText },
  { name: "Invoices", path: "/admin/invoices", icon: ReceiptText },
  { name: "Contacts", path: "/admin/contacts", icon: UserRound },
  { name: "Calendar", path: "/admin/calendar", icon: CalendarDays },
  { name: "Shoot day", path: "/admin/shoot-day", icon: CalendarDays },
  { name: "Finance", path: "/admin/finance", icon: Wallet },
];
export const workspaceNavigationGroups = [
  {
    id: "operations",
    label: "Operations",
    icon: Clapperboard,
    items: [
      { name: "Crew & scheduling", path: "/admin/crew", icon: UsersRound },
      {
        name: "Post production",
        path: "/admin/post-production",
        icon: Clapperboard,
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: MessageCircle,
    items: [
      { name: "Client support", path: "/admin/chats", icon: MessageSquare },
      { name: "Email", path: "/admin/email", icon: Mail },
      { name: "WhatsApp", path: "/admin/whatsapp", icon: MessageCircle },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    icon: Layers3,
    items: [
      { name: "Data & backups", path: "/admin/data", icon: HardDrive },
      { name: "Offline drafts", path: "/admin/offline-drafts", icon: FileText },
      { name: "Activity", path: "/admin/activity-log", icon: Bell },
      { name: "Integrations", path: "/admin/integrations", icon: Webhook },
      { name: "Team & access", path: "/admin/users", icon: UsersRound },
      ...(SAAS_RELEASE_ENABLED ? [{ name: "Workspace & plan", path: "/admin/workspace", icon: Layers3 }] : []),
    ],
  },
];


/** Keep mobile navigation, the desktop sidebar and their sort preferences in sync. */
export function commercialNavSections(user, translate) {
  const pages = [...workspacePrimaryItems, ...workspaceNavigationGroups.flatMap(group => group.items)]
    .filter(item => canAccessStudioPath(user, item.path))
    .map(item => item.path === '/admin/post-production' ? { ...item, name: 'Tasks' } : item);
  const workspacePaths = ['/admin', '/admin/post-production', '/admin/studio-projects', '/admin/calendar'];
  const studioPaths = ['/admin/crew', '/admin/activity-log', '/admin/finance', '/admin/chats'];
  const groupLinks = paths => paths.flatMap(path => pages.filter(item => item.path === path));
  return [
    { id: 'workspace', label: translate('Workspace'), items: groupLinks(workspacePaths) },
    { id: 'studio', label: translate('Studio'), items: groupLinks(studioPaths) },
    { id: 'more', label: 'More pages', items: pages.filter(item => !workspacePaths.includes(item.path) && !studioPaths.includes(item.path)) },
  ].filter(group => group.items.length);
}
