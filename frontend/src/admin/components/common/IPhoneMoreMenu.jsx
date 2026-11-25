import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { CircleHelp, ChevronDown, ChevronRight, LogOut, Settings2, X } from 'lucide-react';
import { canAccessStudioPath } from '../../../utils/moduleAccess';
import { useAuth } from '../../../context/AuthContext';
import { useStudioIdentity } from '../../../utils/studioIdentity';
import { studioText } from '../../../utils/studioTranslations';
import WorkspaceSwitcher from '../../../saas/WorkspaceSwitcher';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import StudioProductBrand from '../../../components/StudioProductBrand';
import useStudioDialog from '../studio/useStudioDialog';
import { useStudioPreferences } from './StudioPreferences';
import StudioAppIcon from './StudioAppIcon';
import StudioIcon from './StudioIcon';
import SidebarOrganizer from './SidebarOrganizer';
import { sortSidebarItems } from '../../../utils/sidebarOrder';
import MobileNavigation from './MobileNavigation';
import { commercialNavSections, workspaceNavTarget, workspacePrimaryItems as allPrimaryItems, workspaceNavigationGroups as allNavigationGroups, workspaceIconTones } from './workspaceNavigation';

export default function IPhoneMoreMenu({ onClose, leaving = false }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const workspacePrimaryItems = allPrimaryItems.filter(item => canAccessStudioPath(user, item.path));
  const workspaceNavigationGroups = allNavigationGroups.map(group => ({ ...group, items: group.items.filter(item => canAccessStudioPath(user, item.path)) })).filter(group => group.items.length);
  const identity = useStudioIdentity();
  const { preferences } = useStudioPreferences();
  const [groupId, setGroupId] = useState(null);
  const dialogRef = useStudioDialog(onClose, { enabled: !leaving });
  const t = label => studioText(preferences.language, label);
  const sorted = items => IS_COMMERCIAL_DEPLOYMENT ? sortSidebarItems(items, preferences.sidebarSort, preferences.sidebarOrder, preferences.language) : items;
  const sections = IS_COMMERCIAL_DEPLOYMENT ? commercialNavSections(user, t) : [
    { id: 'shortcuts', label: 'Workspace shortcuts', items: workspacePrimaryItems },
    ...workspaceNavigationGroups.map(group => ({ ...group, label: group.id === 'communication' ? 'Connections' : t(group.label) })),
  ].filter(section => section.items.length);
  const [moreExpanded, setMoreExpanded] = useState(() => sections.find(section => section.id === 'more')?.items.some(item => pathname === item.path || pathname.startsWith(item.path + '/')) || false);
  const selectedGroup = workspaceNavigationGroups.find(group => group.id === groupId);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Your profile';
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'ST';
  const renderShortcut = item => <NavLink key={item.path} to={workspaceNavTarget(item.path, pathname)} end={item.exact} onClick={onClose} className={({ isActive }) => 'studio-more-shortcut' + (isActive ? ' is-active' : '')}>
    {IS_COMMERCIAL_DEPLOYMENT ? <StudioIcon icon={item.icon} size={18} decorative /> : <StudioAppIcon icon={item.icon} tone={workspaceIconTones[item.path]} size={34} />}
    <span lang={preferences.language} dir="auto">{t(item.name)}</span>
  </NavLink>;
  const groupButton = group => group && <button type="button" key={group.id} aria-expanded={groupId === group.id} aria-controls="studio-more-group-pages" onClick={() => setGroupId(current => current === group.id ? null : group.id)} className={'studio-more-group-button' + (groupId === group.id ? ' is-selected' : '')}>
    <group.icon size={18} aria-hidden="true" />
    <span>{group.id === 'communication' ? 'Connections' : t(group.label)}</span>
    <ChevronDown size={15} aria-hidden="true" />
  </button>;

  return createPortal(<div data-leaving={leaving || undefined} inert={leaving} aria-hidden={leaving || undefined} className={'studio-app studio-personal-workspace studio-native-phone studio-iphone-more-overlay' + (IS_COMMERCIAL_DEPLOYMENT ? ' studio-commercial-glass' : '')} data-studio-text-size={preferences.textSize} data-studio-theme={preferences.theme}>
    <button type="button" className="studio-more-scrim" aria-label="Close More menu" data-studio-dismiss-for="studio-iphone-more" onClick={onClose} tabIndex={-1} />
    <section id="studio-iphone-more" className="studio-more-dialog" role="dialog" aria-modal={leaving ? undefined : true} aria-labelledby="studio-more-title" ref={dialogRef} tabIndex={-1}>
      <div className="studio-more-panel">
        <span className="studio-more-handle" aria-hidden="true" />
        <header className="studio-more-header">{IS_COMMERCIAL_DEPLOYMENT && <StudioProductBrand compact />}<div>{!IS_COMMERCIAL_DEPLOYMENT && <StudioProductBrand />}<h2 id="studio-more-title">More</h2><p>{user?.workspace?.name || identity.name}</p></div><button type="button" className="studio-more-close" aria-label="Close More menu" onClick={onClose}><X size={19} /></button></header>
        <div className="studio-more-content">
          {IS_COMMERCIAL_DEPLOYMENT ? sections.map(section => {
            const links = <nav className="sx-more-links" aria-label={section.label}>{sorted(section.items).map(renderShortcut)}</nav>;
            if (section.id === 'more') return <section className="sx-more-section" key={section.id}>
              <button type="button" className="sx-more-disclosure" aria-expanded={moreExpanded} aria-controls="sx-mobile-more-pages" onClick={() => setMoreExpanded(value => !value)}>{section.label}<ChevronDown size={16} aria-hidden="true" /></button>
              <div id="sx-mobile-more-pages" hidden={!moreExpanded}>{links}</div>
            </section>;
            return <section className="sx-more-section" key={section.id}><h3>{section.label}</h3>{links}</section>;
          }) : <>
          <nav className="studio-more-shortcuts" aria-label="Workspace shortcuts">{sorted(workspacePrimaryItems).map(renderShortcut)}</nav>
          <div className="studio-more-categories">{workspaceNavigationGroups.filter(group => group.id !== 'studio').map(groupButton)}</div>
          {selectedGroup && groupId !== 'studio' && <nav id="studio-more-group-pages" className="studio-more-group-pages" aria-label={selectedGroup.label}>{sorted(selectedGroup.items).map(renderShortcut)}</nav>}
          <div className="studio-more-studio-tools">{groupButton(workspaceNavigationGroups.find(group => group.id === 'studio'))}</div>
          {selectedGroup && groupId === 'studio' && <nav id="studio-more-group-pages" className="studio-more-group-pages" aria-label="Studio tools">{sorted(selectedGroup.items).map(renderShortcut)}</nav>}
          </>}
          {user?.workspace && <div className="studio-more-workspace-switch"><WorkspaceSwitcher onNavigate={onClose} /></div>}
          {canAccessStudioPath(user, "/admin/settings") && <NavLink to="/admin/settings" onClick={onClose} className="studio-more-settings">{IS_COMMERCIAL_DEPLOYMENT ? <Settings2 size={18} aria-hidden="true" /> : <StudioAppIcon icon={Settings2} tone="slate" size={28} />}<span>{t('Settings')}</span><ChevronRight size={17} aria-hidden="true" /></NavLink>}
          {IS_COMMERCIAL_DEPLOYMENT && <>
            <SidebarOrganizer sections={sections} mobile />
            <NavLink to="/studio-os/docs" className="studio-more-settings" onClick={onClose}><CircleHelp size={18} aria-hidden="true" /><span>{t('Help')}</span><ChevronRight size={17} aria-hidden="true" /></NavLink>
          </>}
          <div className="studio-more-account"><NavLink to={canAccessStudioPath(user, "/admin/settings") ? "/admin/settings?section=workspace" : "/admin"} onClick={onClose} className="studio-more-profile" aria-label="Your workspace preferences"><span className="studio-more-avatar">{initials}</span><span><strong>{fullName}</strong><small>My workspace</small></span></NavLink><button type="button" className="studio-more-signout" onClick={() => { onClose(); logout(); }}><LogOut size={19} aria-hidden="true" /><span>{t('Sign out')}</span></button></div>
        </div>
      </div>
      <MobileNavigation appMenu menuOpen onMenuClick={onClose} onNavigate={onClose} controlsId="studio-iphone-more" />
    </section>
  </div>, document.body);
}
