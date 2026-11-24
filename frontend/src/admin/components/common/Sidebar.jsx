import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStudioIdentity } from "../../../utils/studioIdentity";
import { canAccessStudioPath, hasModuleAccess } from '../../../utils/moduleAccess';
import StudioAppIcon from "./StudioAppIcon";
import SidebarOrganizer from './SidebarOrganizer';
import { sortSidebarItems } from '../../../utils/sidebarOrder';
import { useStudioPreferences } from './StudioPreferences';
import { studioText } from '../../../utils/studioTranslations';
import WorkspaceSwitcher from '../../../saas/WorkspaceSwitcher';
import StudioProductBrand from '../../../components/StudioProductBrand';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';
import { X, LogOut, Settings2, ArrowUpRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Search, CircleHelp, Layers3 } from "lucide-react";
import { workspaceNavTarget, workspaceIconTones as iconTones, workspacePrimaryItems as primaryItems, workspaceNavigationGroups as groups } from "./workspaceNavigation";

import { useWorkspaceRailMotion } from './useWorkspaceRailMotion';
import WorkspaceNavIndicator from './WorkspaceNavIndicator';

const API_URL = import.meta.env.VITE_API_URL || "";
export default function Sidebar({ onClose, compact, onToggleCompact }) {
  const identity = useStudioIdentity();
  const { preferences } = useStudioPreferences();
  const t = text => studioText(preferences.language, text);
  const { user, token, logout } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState('');
  const searchTerm = compact ? '' : query.trim().toLowerCase();
  const aliases = { Quotations: 'quotes proposal', Contacts: 'clients address book', Finance: 'invoices payments expenses', Email: 'gmail mail inbox', 'Client support': 'chat messages', 'Crew & scheduling': 'team photographers', Tasks: 'post production editing delivery' };
  const matches = item => (item.name + ' ' + t(item.name) + ' ' + (aliases[item.name] || '')).toLowerCase().includes(searchTerm);
  // Commercial tasks belong alongside projects, rather than behind a second
  // navigation layer. The destination and its permission gate stay the same.
  const taskItem = groups.find(group => group.id === 'operations')?.items.find(item => item.path === '/admin/post-production');
  const navigationPrimary = IS_COMMERCIAL_DEPLOYMENT && taskItem
    ? [primaryItems[0], { ...taskItem, name: 'Tasks' }, ...primaryItems.slice(1)]
    : primaryItems;
  const matchingPrimary = navigationPrimary.filter(item => canAccessStudioPath(user, item.path) && matches(item));
  const matchingGroups = groups.map(group => ({ ...group, items: group.items.filter(item => !(IS_COMMERCIAL_DEPLOYMENT && item.path === '/admin/post-production') && canAccessStudioPath(user, item.path) && (matches(item) || matches({ name: group.label }))) })).filter(group => group.items.length);
  const closeNavigation = () => { setQuery(''); onClose?.(); };
  const [unreadCount, setUnreadCount] = useState(0);
  const navRef = useRef(null);
  const { railRef, toggleRail } = useWorkspaceRailMotion(compact, onToggleCompact);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname, compact]);
  useEffect(() => {
    if (!user || !token || !hasModuleAccess(user, 'support')) return;
    const controller = new AbortController();
    const refresh = () =>
      fetch(API_URL + "/api/project-support/unread", {
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data && !controller.signal.aborted)
            setUnreadCount(data.count || 0);
        })
        .catch(() => {});
    refresh();
    const poll = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(poll, 30000);
    window.addEventListener("studio-support-read", refresh);
    document.addEventListener("visibilitychange", poll);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("studio-support-read", refresh);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [user, token]);

  const renderLink = (item) => (
    <NavLink
      key={item.path}
      to={workspaceNavTarget(item.path, pathname)}
      end={item.exact}
      onClick={closeNavigation}
      title={compact ? t(item.name) : undefined}
      aria-label={compact ? t(item.name) : undefined}
      className={({ isActive }) =>
        "studio-nav-item" + (isActive ? " is-active" : "")
      }
    >
      <StudioAppIcon icon={item.icon} tone={iconTones[item.path]} size={28} />
      <span className="studio-nav-text" lang={preferences.language} dir="auto">{t(item.name)}</span>
      {item.path === "/admin/chats" && preferences.notificationBadges && preferences.notificationCategories.includes('messages') && unreadCount > 0 && (
        <span
          className="studio-nav-count"
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </NavLink>
  );
  if (IS_COMMERCIAL_DEPLOYMENT) {
    const pages = [...navigationPrimary, ...groups.flatMap(group => group.items)]
      .filter((item, index, all) => all.findIndex(other => other.path === item.path) === index)
      .filter(item => canAccessStudioPath(user, item.path));
    const workspacePaths = ['/admin', '/admin/post-production', '/admin/studio-projects', '/admin/calendar'];
    const studioPaths = ['/admin/crew', '/admin/activity-log', '/admin/finance', '/admin/chats'];
    const groupLinks = paths => paths.flatMap(path => pages.filter(item => item.path === path));
    const extraPages = pages.filter(item => !workspacePaths.includes(item.path) && !studioPaths.includes(item.path));
    const sections = [
      { id: 'workspace', label: t('Workspace'), items: groupLinks(workspacePaths) },
      { id: 'studio', label: t('Studio'), items: groupLinks(studioPaths) },
      { id: 'more', label: 'More pages', items: extraPages },
    ].filter(section => section.items.length);
    const sorted = items => sortSidebarItems(items, preferences.sidebarSort, preferences.sidebarOrder, preferences.language);
    const activeExtra = extraPages.some(item => pathname === item.path || pathname.startsWith(item.path + '/'));
    const moreOpen = expanded.more?.pathname === pathname ? expanded.more.open : activeExtra;
    const visibleExtras = sorted(extraPages).filter(matches);
    return <aside ref={railRef} className="studio-sidebar sx-desk-sidebar" aria-label="Studio navigation">
      <div className="sx-desk-nav-panel">
        <header className="sx-desk-brand-row">
          <Link className="sx-desk-brand" to="/admin" onClick={closeNavigation} aria-label="Studio X OS overview">
            <StudioProductBrand compact />
            <span className="sx-desk-brand-name"><strong>Studio X OS</strong><small>{user?.workspace?.name || identity.name}</small></span>
          </Link>
          {onToggleCompact ? <button type="button" className="sx-desk-rail-toggle" onClick={toggleRail}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!compact} title={compact ? 'Expand sidebar' : 'Collapse sidebar'}>
            {compact ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button> : <button type="button" className="sx-desk-rail-toggle" onClick={onClose} aria-label="Close navigation"><X size={16} /></button>}
        </header>
        <nav ref={navRef} className="studio-nav sx-desk-nav" aria-label="Workspace pages">
          <WorkspaceNavIndicator navRef={navRef} selection={[pathname, compact, moreOpen, query, pages.length, preferences.language, preferences.sidebarSort, preferences.sidebarOrder].join('|')} />
          {sections.filter(section => section.id !== 'more').map(section =>
            <section className="sx-desk-nav-group" key={section.id} aria-label={section.label}>
              <h2>{section.label}</h2>{sorted(section.items).map(renderLink)}
            </section>)}
          {extraPages.length > 0 && <div className="sx-desk-extra-pages">
            <button type="button" className={'studio-nav-item sx-desk-more' + (activeExtra && !moreOpen ? ' has-current' : '')}
              onClick={() => { setExpanded(current => ({ ...current, more: { pathname, open: !moreOpen } })); setQuery(''); }}
              aria-expanded={moreOpen} aria-controls="sx-other-pages" aria-label="More pages" title={compact ? 'More pages' : undefined}>
              <Layers3 size={17} aria-hidden="true" /><span className="studio-nav-text">More pages</span><ChevronDown size={14} className="sx-desk-expand-icon" aria-hidden="true" />
            </button>
            <div id="sx-other-pages" hidden={!moreOpen}>
              {!compact && <label className="sx-desk-filter"><Search size={15} aria-hidden="true" />
                <input type="search" aria-label="Find a workspace page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
              {visibleExtras.map(renderLink)}
              {!visibleExtras.length && <p role="status" className="studio-menu-empty">No matching pages.</p>}
            </div>
          </div>}
          <div className="sx-desk-nav-foot">
            <SidebarOrganizer sections={sections} compact={compact} />
            {canAccessStudioPath(user, '/admin/settings') && renderLink({ name: 'Settings', path: '/admin/settings', icon: Settings2 })}
            <Link to="/studio-os/docs" className="studio-nav-item" title={compact ? 'Help' : undefined} onClick={closeNavigation} aria-label="Help">
              <CircleHelp size={17} /><span className="studio-nav-text">{t('Help')}</span></Link>
          </div>
        </nav>
      </div>
      <div className="sx-desk-account-panel">
        {user?.isPreview && <p className="sx-desk-preview-note">Sample workspace</p>}
        {user?.workspace && <WorkspaceSwitcher compact={compact} onNavigate={closeNavigation} />}
        <div className="sx-desk-account-actions">
          <Link to="/" onClick={closeNavigation} title={t('View website')} aria-label={t('View website')}><span>{t('View website')}</span><ArrowUpRight size={15} /></Link>
          <button type="button" onClick={logout} title={t('Sign out')} aria-label={t('Sign out')}><LogOut size={16} /></button>
        </div>
      </div>
    </aside>;
  }
  return (
    <aside className="studio-sidebar" aria-label="Studio navigation">
      <div className="studio-brand-row">
        {user?.workspace ? <WorkspaceSwitcher compact={compact} onNavigate={onClose} /> : <Link
          to="/admin"
          className="studio-brand studio-x-brand"
          onClick={closeNavigation}
          aria-label={`${identity.name} — Studio X OS home`}
          title={compact ? identity.name : undefined}
        >
          <StudioProductBrand />
          <small>{identity.name}</small>
        </Link>}
        {onToggleCompact && <button
          type="button"
          className="studio-sidebar-resize"
          onClick={onToggleCompact}
          aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
          title={compact ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!compact}
        >
          {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>}
        <button
          type="button"
          className="studio-nav-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>
      {!compact && <label className="studio-menu-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Find a workspace page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear menu search" onClick={() => setQuery('')}><X size={16} /></button>}</label>}
      <nav ref={navRef} className="studio-nav" aria-label="Workspace pages">
        {matchingPrimary.length > 0 && <div className="studio-nav-section-label" lang={preferences.language} dir="auto">{t('Workspace')}</div>}
        <div className="studio-nav-primary">{matchingPrimary.map(renderLink)}</div>
        {!matchingPrimary.length && !matchingGroups.length && !matches({ name: "Settings" }) && <p className="studio-menu-empty" role="status">No pages found. Try “calendar” or “settings”.</p>}
        {searchTerm && matches({ name: 'Settings' }) && renderLink({ name: 'Settings', path: '/admin/settings', icon: Settings2 })}
        {matchingGroups.map((group) => {
          const containsCurrentPage = group.items.some(
            (item) =>
              pathname === item.path || pathname.startsWith(item.path + "/"),
          );
          // Opening a deep link should reveal its section, even after a previous
          // page's section was collapsed. Manual collapsing still works here.
          const override = expanded[group.id];
          const isExpanded = searchTerm ? true : override?.pathname === pathname
            ? override.open
            : containsCurrentPage || (override?.open ?? false);
          const GroupIcon = group.icon;
          return (
            <section className="studio-nav-group" key={group.id}>
              <button
                type="button"
                className={
                  "studio-nav-group-toggle" +
                  (containsCurrentPage ? " has-current-page" : "")
                }
                aria-expanded={isExpanded}
                aria-label={t(group.label)}
                title={compact ? t(group.label) : undefined}
                aria-controls={`studio-nav-${group.id}`}
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [group.id]: { open: !isExpanded, pathname },
                  }))
                }
              >
                <GroupIcon className="studio-nav-group-icon" size={18} aria-hidden="true" />
                <span className="studio-nav-text" lang={preferences.language} dir="auto">{t(group.label)}</span>
                {group.id === "communication" && preferences.notificationBadges && preferences.notificationCategories.includes('messages') && unreadCount > 0 && !isExpanded && <span className="studio-group-unread" aria-label={`${unreadCount} unread support messages`} />}
                <ChevronDown className="studio-nav-chevron" size={14} aria-hidden="true" />
              </button>
              <div id={`studio-nav-${group.id}`} hidden={!isExpanded}>
                {group.items.map(renderLink)}
              </div>
            </section>
          );
        })}
      </nav>
      <div className="studio-sidebar-bottom">
        <div className="studio-sidebar-utilities">
          {canAccessStudioPath(user, "/admin/settings") && renderLink({ name: "Settings", path: "/admin/settings", icon: Settings2 })}
          <Link to="/" onClick={onClose} className="studio-website-shortcut" aria-label={t('View website')} title={t('View website')}><ArrowUpRight size={18} /></Link>
        </div>
        <div className="studio-sidebar-profile">
          <Link to={canAccessStudioPath(user, "/admin/settings") ? "/admin/settings?section=workspace" : "/admin"} onClick={onClose} className="studio-avatar" aria-label="Your workspace preferences" title="Your workspace preferences">
            {user?.firstName?.[0] || "A"}
            {user?.lastName?.[0] || ""}
          </Link>
          <div className="studio-sidebar-user-copy">
            <strong>
              {user?.firstName || "Studio"} {user?.lastName || ""}
            </strong>
            <small>Administrator</small>
          </div>
          <button
            type="button"
            aria-label={t('Sign out')}
            title={t('Sign out')}
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
