import { useAuth } from '../../../context/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';
import { Grid2X2 } from 'lucide-react';
import { useStudioPreferences } from './StudioPreferences';
import { studioText } from '../../../utils/studioTranslations';
import StudioAppIcon from './StudioAppIcon';

import { workspaceMobileTabs, workspaceNavTarget } from './workspaceNavigation';

export default function MobileNavigation({ onMenuClick, menuOpen, onNavigate, appMenu = false, controlsId = 'studio-navigation-drawer' }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { preferences } = useStudioPreferences();
  const tabs = workspaceMobileTabs(user, preferences.mobileTab);
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
