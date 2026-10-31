import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, Settings2, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useStudioIdentity } from '../../../utils/studioIdentity';
import { studioText } from '../../../utils/studioTranslations';
import WorkspaceSwitcher from '../../../saas/WorkspaceSwitcher';
import useStudioDialog from '../studio/useStudioDialog';
import { useStudioPreferences } from './StudioPreferences';
import StudioAppIcon from './StudioAppIcon';
import MobileNavigation from './MobileNavigation';
import { workspacePrimaryItems, workspaceNavigationGroups, workspaceIconTones } from './workspaceNavigation';

export default function IPhoneMoreMenu({ onClose }) {
  const { user, logout } = useAuth();
  const identity = useStudioIdentity();
  const { preferences } = useStudioPreferences();
  const [groupId, setGroupId] = useState(null);
  const dialogRef = useStudioDialog(onClose);
  const t = label => studioText(preferences.language, label);
  const selectedGroup = workspaceNavigationGroups.find(group => group.id === groupId);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Your profile';
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'ST';
  const renderShortcut = item => <NavLink key={item.path} to={item.path} end={item.exact} onClick={onClose} className={({ isActive }) => 'studio-more-shortcut' + (isActive ? ' is-active' : '')}>
    <StudioAppIcon icon={item.icon} tone={workspaceIconTones[item.path]} size={34} />
    <span lang={preferences.language} dir="auto">{t(item.name)}</span>
  </NavLink>;
  const groupButton = group => <button type="button" key={group.id} aria-expanded={groupId === group.id} aria-controls="studio-more-group-pages" onClick={() => setGroupId(current => current === group.id ? null : group.id)} className={'studio-more-group-button' + (groupId === group.id ? ' is-selected' : '')}>
    <group.icon size={18} aria-hidden="true" />
    <span>{group.id === 'communication' ? 'Connections' : t(group.label)}</span>
    <ChevronDown size={15} aria-hidden="true" />
  </button>;

  return createPortal(<div className="studio-app studio-personal-workspace studio-native-phone studio-iphone-more-overlay" data-studio-text-size={preferences.textSize} data-studio-theme={preferences.theme}>
    <button type="button" className="studio-more-scrim" aria-label="Close More menu" data-studio-dismiss-for="studio-iphone-more" onClick={onClose} tabIndex={-1} />
    <section id="studio-iphone-more" className="studio-more-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-more-title" ref={dialogRef} tabIndex={-1}>
      <div className="studio-more-panel">
        <span className="studio-more-handle" aria-hidden="true" />
        <header className="studio-more-header"><div><h2 id="studio-more-title">More</h2><p>{identity.name}</p></div><button type="button" className="studio-more-close" aria-label="Close More menu" onClick={onClose}><X size={19} /></button></header>
        <div className="studio-more-content">
          <nav className="studio-more-shortcuts" aria-label="Workspace shortcuts">{workspacePrimaryItems.map(renderShortcut)}</nav>
          <div className="studio-more-categories">{workspaceNavigationGroups.filter(group => group.id !== 'studio').map(groupButton)}</div>
          {groupId && groupId !== 'studio' && <nav id="studio-more-group-pages" className="studio-more-group-pages" aria-label={selectedGroup.label}>{selectedGroup.items.map(renderShortcut)}</nav>}
          <div className="studio-more-studio-tools">{groupButton(workspaceNavigationGroups.find(group => group.id === 'studio'))}</div>
          {groupId === 'studio' && <nav id="studio-more-group-pages" className="studio-more-group-pages" aria-label="Studio tools">{selectedGroup.items.map(renderShortcut)}</nav>}
          {user?.workspace && <div className="studio-more-workspace-switch"><WorkspaceSwitcher onNavigate={onClose} /></div>}
          <NavLink to="/admin/settings" onClick={onClose} className="studio-more-settings"><StudioAppIcon icon={Settings2} tone="slate" size={28} /><span>{t('Settings')}</span><ChevronRight size={17} aria-hidden="true" /></NavLink>
          <div className="studio-more-account"><NavLink to="/admin/settings?section=workspace" onClick={onClose} className="studio-more-profile" aria-label="Your workspace preferences"><span className="studio-more-avatar">{initials}</span><span><strong>{fullName}</strong><small>My workspace</small></span></NavLink><button type="button" className="studio-more-signout" onClick={() => { onClose(); logout(); }}><LogOut size={19} aria-hidden="true" /><span>{t('Sign out')}</span></button></div>
        </div>
      </div>
      <MobileNavigation appMenu menuOpen onMenuClick={onClose} onNavigate={onClose} controlsId="studio-iphone-more" />
    </section>
  </div>, document.body);
}
