import { useAuth } from '../../../context/AuthContext';
import { canAccessStudioPath } from '../../../utils/moduleAccess';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListTodo, MessageSquare, CalendarDays, Wallet, Folder, Grid2X2 } from 'lucide-react';
import { useStudioPreferences } from './StudioPreferences';
import { studioText } from '../../../utils/studioTranslations';
import StudioAppIcon from './StudioAppIcon';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';

import { workspaceNavTarget } from './workspaceNavigation';

const baseTabs = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard, tone: 'blue', end: true },
  { label: 'Enquiries', path: '/admin/crm', icon: MessageSquare, tone: 'cyan' },
  { label: 'Projects', path: '/admin/studio-projects', icon: Folder, tone: 'indigo' },
  { label: 'Calendar', path: '/admin/calendar', icon: CalendarDays, tone: 'rose' },
];

export default function MobileNavigation({ onMenuClick, menuOpen, onNavigate, appMenu = false, controlsId = 'studio-navigation-drawer' }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { preferences } = useStudioPreferences();
  const primaryTabs = IS_COMMERCIAL_DEPLOYMENT ? baseTabs.map(tab => tab.path === '/admin/crm' ? { label: 'Tasks', path: '/admin/post-production', icon: ListTodo, tone: 'violet' } : tab) : baseTabs;
  const tabs = (preferences.mobileTab === 'finance' && canAccessStudioPath(user, '/admin/finance') ? primaryTabs.map(tab => tab.label === 'Projects' ? {label:'Finance',path:'/admin/finance',icon:Wallet,tone:'green'} : tab) : primaryTabs).filter(tab => canAccessStudioPath(user, tab.path));
  const t = label => studioText(preferences.language, label);
  const otherPage = !tabs.some(tab => tab.end ? pathname === workspaceNavTarget(tab.path, pathname) : pathname === tab.path || pathname.startsWith(tab.path + '/'));
  return <nav className="studio-mobile-navigation" style={{ gridTemplateColumns: "repeat(" + (tabs.length + 1) + ",minmax(0,1fr))" }} aria-label="Main workspace navigation">
    {tabs.map(({ label, path, icon, tone, end }) => <NavLink key={path} to={workspaceNavTarget(path, pathname)} end={end} onClick={onNavigate} className={({ isActive }) => isActive && !(appMenu && menuOpen) ? 'is-active' : ''}>
      <StudioAppIcon icon={icon} tone={tone} size={30} className="studio-mobile-tab-icon" /><span className="studio-mobile-tab-label" lang={preferences.language}>{t(label)}</span>
    </NavLink>)}
    <button type="button" onClick={onMenuClick} aria-label="All workspace pages" aria-expanded={menuOpen} aria-controls={controlsId} className={otherPage || (appMenu && menuOpen) ? 'is-active' : ''}>
      <StudioAppIcon icon={Grid2X2} tone="slate" size={30} className="studio-mobile-tab-icon" /><span className="studio-mobile-tab-label">More</span>
    </button>
  </nav>;
}
