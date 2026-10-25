import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { TEAM_ALPHA_LOGO } from "../../../utils/branding";
import {
  LayoutDashboard,
  UsersRound,
  Wallet,
  CalendarDays,
  X,
  LogOut,
  MessageSquare,
  Bell,
  Settings2,
  Folder,
  Clapperboard,
  ArrowUpRight,
  Webhook,
  FileText,
  HardDrive,
  UserRound,
  ChevronDown,
  Mail,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";
const primaryItems = [
  { name: "Overview", path: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Enquiries", path: "/admin/crm", icon: MessageSquare },
  { name: "Projects", path: "/admin/studio-projects", icon: Folder },
  { name: "Quotations", path: "/admin/quotations", icon: FileText },
  { name: "Contacts", path: "/admin/contacts", icon: UserRound },
  { name: "Calendar", path: "/admin/calendar", icon: CalendarDays },
  { name: "Finance", path: "/admin/finance", icon: Wallet },
];
const groups = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        name: "Quote templates",
        path: "/admin/quote-templates",
        icon: FileText,
      },
      { name: "Production projects", path: "/admin/projects", icon: Folder },
      { name: "Crew & scheduling", path: "/admin/crew", icon: UsersRound },
      {
        name: "Post production",
        path: "/admin/post-production",
        icon: Clapperboard,
      },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    items: [
      { name: "Data & backups", path: "/admin/data", icon: HardDrive },
      { name: "Client support", path: "/admin/chats", icon: MessageSquare },
      { name: "Activity", path: "/admin/activity-log", icon: Bell },
      { name: "Integrations", path: "/admin/integrations", icon: Webhook },
      { name: "Email", path: "/admin/email", icon: Mail },
      { name: "Settings", path: "/admin/settings", icon: Settings2 },
      { name: "Team & access", path: "/admin/users", icon: UsersRound },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const { user, token, logout } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
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
      onClick={onClose}
      className={({ isActive }) =>
        "studio-nav-item" + (isActive ? " is-active" : "")
      }
    >
      <item.icon size={18} strokeWidth={1.75} />
      <span>{item.name}</span>
      {item.path === "/admin/chats" && unreadCount > 0 && (
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
        <Link
          to="/admin"
          className="studio-brand"
          onClick={onClose}
          aria-label="Team Alpha Studio OS home"
        >
          <span className="studio-brand-mark">
            <img src={TEAM_ALPHA_LOGO} alt="" width="52" height="52" />
          </span>
          <span>
            <strong>Team Alpha</strong>
            <small>Studio OS</small>
          </span>
        </Link>
        <button
          type="button"
          className="studio-nav-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>
      <nav className="studio-nav" aria-label="Workspace pages">
        <div className="studio-nav-primary">{primaryItems.map(renderLink)}</div>
        {groups.map((group) => {
          const containsCurrentPage = group.items.some(
            (item) =>
              pathname === item.path || pathname.startsWith(item.path + "/"),
          );
          const isExpanded = expanded[group.id] ?? containsCurrentPage;
          return (
            <section className="studio-nav-group" key={group.id}>
              <button
                type="button"
                className={
                  "studio-nav-group-toggle" +
                  (containsCurrentPage ? " has-current-page" : "")
                }
                aria-expanded={isExpanded}
                aria-controls={`studio-nav-${group.id}`}
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [group.id]: !isExpanded,
                  }))
                }
              >
                <span>{group.label}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              <div id={`studio-nav-${group.id}`} hidden={!isExpanded}>
                {group.items.map(renderLink)}
              </div>
            </section>
          );
        })}
      </nav>
      <div className="studio-sidebar-bottom">
        <Link to="/" className="studio-portfolio-link">
          <span>View website</span>
          <ArrowUpRight size={16} />
        </Link>
        <div className="studio-sidebar-profile">
          <span className="studio-avatar">
            {user?.firstName?.[0] || "A"}
            {user?.lastName?.[0] || ""}
          </span>
          <div>
            <strong>
              {user?.firstName || "Studio"} {user?.lastName || ""}
            </strong>
            <small>Administrator</small>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
