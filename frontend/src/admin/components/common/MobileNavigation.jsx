import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, CalendarDays, Wallet, Folder, Grid2X2 } from 'lucide-react';
import { useStudioPreferences } from './StudioPreferences';
import { studioText } from '../../../utils/studioTranslations';
import StudioAppIcon from './StudioAppIcon';

const baseTabs = [
  { label: 'Overview', path: '/admin', icon: LayoutDashboard, tone: 'blue', end: true },
  { label: 'Enquiries', path: '/admin/crm', icon: MessageSquare, tone: 'cyan' },
  { label: 'Projects', path: '/admin/studio-projects', icon: Folder, tone: 'indigo' },
  { label: 'Calendar', path: '/admin/calendar', icon: CalendarDays, tone: 'rose' },
];

export default function MobileNavigation({ onMenuClick, menuOpen, onNavigate, appMenu = false, controlsId = 'studio-navigation-drawer' }) {
  const { pathname } = useLocation();
  const { preferences } = useStudioPreferences();
  const tabs = preferences.mobileTab === 'finance' ? baseTabs.map(tab => tab.label === 'Projects' ? {label:'Finance',path:'/admin/finance',icon:Wallet,tone:'green'} : tab) : baseTabs;
  const t = label => studioText(preferences.language, label);
  const otherPage = !tabs.some(tab => tab.end ? pathname === tab.path : pathname === tab.path || pathname.startsWith(tab.path + '/'));
  return <nav className="studio-mobile-navigation" aria-label="Main workspace navigation">
    {tabs.map(({ label, path, icon, tone, end }) => <NavLink key={path} to={path} end={end} onClick={onNavigate} className={({ isActive }) => isActive && !(appMenu && menuOpen) ? 'is-active' : ''}>
      <StudioAppIcon icon={icon} tone={tone} size={30} className="studio-mobile-tab-icon" /><span className="studio-mobile-tab-label" lang={preferences.language}>{t(label)}</span>
    </NavLink>)}
    <button type="button" onClick={onMenuClick} aria-label="All workspace pages" aria-expanded={menuOpen} aria-controls={controlsId} className={otherPage || (appMenu && menuOpen) ? 'is-active' : ''}>
      <StudioAppIcon icon={Grid2X2} tone="slate" size={30} className="studio-mobile-tab-icon" /><span className="studio-mobile-tab-label">More</span>
    </button>
  </nav>;
}
