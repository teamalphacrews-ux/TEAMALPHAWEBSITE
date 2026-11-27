import { LayoutDashboard, UsersRound, Wallet, CalendarDays, MessageSquare, Bell, Folder, Clapperboard, Webhook, FileText, ReceiptText, ListTodo, HardDrive, UserRound, Mail, MessageCircle, Layers3 } from 'lucide-react';
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


const commercialGroups = [
  { id: 'workspace', label: 'Workspace', icon: LayoutDashboard, paths: ['/admin', '/admin/crm', '/admin/contacts', '/admin/studio-projects', '/admin/post-production', '/admin/calendar'] },
  { id: 'billing', label: 'Billing & payments', icon: Wallet, paths: ['/admin/quotations', '/admin/invoices', '/admin/finance'] },
  { id: 'operations', label: 'Operations', icon: Clapperboard, paths: ['/admin/shoot-day', '/admin/crew'] },
  workspaceNavigationGroups.find(group => group.id === 'communication'),
  workspaceNavigationGroups.find(group => group.id === 'studio'),
];

const workspacePages = new Map(
  [...workspacePrimaryItems, ...workspaceNavigationGroups.flatMap(group => group.items)].map(item => [item.path, item]),
);
const commercialTasks = { name: 'Tasks', path: '/admin/post-production', icon: ListTodo };

export function commercialNavSections(user, translate) {
  return commercialGroups.map(({ id, label, icon, paths, items }) => ({
    id,
    label: translate(label),
    name: label,
    icon,
    items: (items ?? paths.map(path => path === commercialTasks.path ? commercialTasks : workspacePages.get(path)))
      .filter(item => canAccessStudioPath(user, item.path)),
  })).filter(section => section.items.length);
}

export function workspaceMobileTabs(user, mobileTab) {
  const tabs = [
    workspacePages.get('/admin'),
    IS_COMMERCIAL_DEPLOYMENT ? commercialTasks : workspacePages.get('/admin/crm'),
    workspacePages.get(mobileTab === 'finance' && canAccessStudioPath(user, '/admin/finance') ? '/admin/finance' : '/admin/studio-projects'),
    workspacePages.get('/admin/calendar'),
  ];
  return tabs.filter(item => canAccessStudioPath(user, item.path)).map(item => ({
    label: item.name,
    path: item.path,
    icon: item.icon,
    tone: workspaceIconTones[item.path],
    end: item.exact,
  }));
}
