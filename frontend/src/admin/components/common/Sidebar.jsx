import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStudioIdentity } from "../../../utils/studioIdentity";
import StudioAppIcon from "./StudioAppIcon";
import { useStudioPreferences } from './StudioPreferences';
import { studioText } from '../../../utils/studioTranslations';
import WorkspaceSwitcher from '../../../saas/WorkspaceSwitcher';
import { X, LogOut, Settings2, ArrowUpRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { workspaceIconTones as iconTones, workspacePrimaryItems as primaryItems, workspaceNavigationGroups as groups } from "./workspaceNavigation";

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
  const aliases = { Quotations: 'quotes proposal', Contacts: 'clients address book', Finance: 'invoices payments expenses', Email: 'gmail mail inbox', 'Client support': 'chat messages', 'Crew & scheduling': 'team photographers' };
  const matches = item => (item.name + ' ' + t(item.name) + ' ' + (aliases[item.name] || '')).toLowerCase().includes(searchTerm);
  const matchingPrimary = primaryItems.filter(matches);
  const matchingGroups = groups.map(group => ({ ...group, items: group.items.filter(item => matches(item) || matches({ name: group.label })) })).filter(group => group.items.length);
  const closeNavigation = () => { setQuery(''); onClose?.(); };
  const [unreadCount, setUnreadCount] = useState(0);
  const navRef = useRef(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname, compact]);
  useEffect(() => {
    if (!user || !token) return;
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
      to={item.path}
      end={item.exact}
      onClick={closeNavigation}
      title={compact ? t(item.name) : undefined}
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
  return (
    <aside className="studio-sidebar" aria-label="Studio navigation">
      <div className="studio-brand-row">
        {user?.workspace ? <WorkspaceSwitcher compact={compact} onNavigate={onClose} /> : <Link
          to="/admin"
          className="studio-brand"
          onClick={closeNavigation}
          aria-label={`${identity.name} Studio OS home`}
          title={compact ? identity.name : undefined}
        >
          <span className="studio-brand-mark">
            <img src={identity.photo} alt="" width="52" height="52" />
          </span>
          <span className="studio-brand-copy">
            <strong>{identity.name}</strong>
            <small>Studio OS</small>
          </span>
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
          {renderLink({ name: "Settings", path: "/admin/settings", icon: Settings2 })}
          <Link to="/" onClick={onClose} className="studio-website-shortcut" aria-label={t('View website')} title={t('View website')}><ArrowUpRight size={18} /></Link>
        </div>
        <div className="studio-sidebar-profile">
          <Link to="/admin/settings?section=workspace" onClick={onClose} className="studio-avatar" aria-label="Your workspace preferences" title="Your workspace preferences">
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
