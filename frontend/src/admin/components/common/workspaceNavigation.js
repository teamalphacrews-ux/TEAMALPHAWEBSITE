import { LayoutDashboard, UsersRound, Wallet, CalendarDays, MessageSquare, Bell, Folder, Clapperboard, Webhook, FileText, HardDrive, UserRound, Mail, MessageCircle, Layers3 } from 'lucide-react';
import { SAAS_RELEASE_ENABLED } from '../../../saas/release';

export const workspaceIconTones = {
  '/admin': 'blue', '/admin/crm': 'cyan', '/admin/studio-projects': 'indigo',
  '/admin/quotations': 'amber', '/admin/contacts': 'slate', '/admin/calendar': 'rose',
  '/admin/finance': 'green', '/admin/quote-templates': 'amber', '/admin/projects': 'indigo',
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

