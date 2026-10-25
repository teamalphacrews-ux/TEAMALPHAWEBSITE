import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Menu, ArrowUpRight, CheckCheck, X, Sun, Moon } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import AdminProfileModal from './AdminProfileModal';
import { useStudioPreferences } from './StudioPreferences';

const API = import.meta.env.VITE_API_URL || '';
const destinations = [
  ["Contacts", "/admin/contacts", "clients leads address"], ["Projects", "/admin/studio-projects", "contact projects documents"], ["Quote templates", "/admin/quote-templates", "reusable proposal templates"],
  ['Overview', '/admin', 'dashboard studio summary'], ['Enquiries', '/admin/crm', 'leads crm follow-up'],
  ['Quotations', '/admin/quotations', 'proposals pricing services terms'], ['Data & backups', '/admin/data', 'nas storage folders backup checks'], ['Settings', '/admin/settings', 'studio profile configuration'],
  ['Production projects', '/admin/projects', 'weddings bookings'], ['Crew & scheduling', '/admin/crew', 'photographers team assignments'],
  ['Post production', '/admin/post-production', 'tasks editing delivery'], ['Calendar', '/admin/calendar', 'shoots events dates'],
  ['Finance', '/admin/finance', 'invoices expenses payments'],
  ['Integrations', '/admin/integrations', 'webhook enquiries connect automation'],
  ['Email', '/admin/email', 'gmail inbox sent mail messages'],
  ['Client support', '/admin/chats', 'messages chat client project help'], ['Activity', '/admin/activity-log', 'notifications'], ['Team & access', '/admin/users', 'settings permissions users'],
];

export default function Topbar({ onMenuClick }) {
  const { user, logout, updateUser } = useAuth();
  const { preferences, update } = useStudioPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const searchShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  const active = destinations.find(item => item[1] !== '/admin' && (item[1] === location.pathname || location.pathname.startsWith(item[1] + '/')))?.[0] || (location.pathname.startsWith('/admin/invoices/') ? 'Invoice' : 'Overview');
  useEffect(() => {
    const searchShortcut = event => {
      if (event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && window.matchMedia('(min-width: 769px)').matches) {
        event.preventDefault();
        setSearchOpen(true);
        setShowNotifications(false);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', searchShortcut);
    return () => window.removeEventListener('keydown', searchShortcut);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const fetchNotifications = async () => {
      try {
        const result = await axios.get(API + '/api/notifications', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, signal: controller.signal });
        setNotifications(Array.isArray(result.data) ? result.data : []);
        setNotificationError(false);
      } catch (error) {
        if (axios.isCancel(error)) return;
        if (error.response?.status === 401) logout();
        setNotificationError(true);
      }
    };
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [logout]);
  useEffect(() => {
    const close = event => { if (!panelRef.current?.contains(event.target)) { setSearchOpen(false); setShowNotifications(false); } };
    const escape = event => { if (event.key === 'Escape') {
      if (document.activeElement?.closest('.studio-notification-panel')) notificationButtonRef.current?.focus();
      else if (document.activeElement?.closest('.studio-search-results')) searchInputRef.current?.focus();
      setSearchOpen(false); setShowNotifications(false);
    } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  const markAll = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try {
      await axios.post(API + '/api/notifications/mark-all-read', {}, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setNotifications(current => current.map(item => ({ ...item, isRead: true })));
    } catch { toast.error('Could not mark notifications as read.'); }
    finally { setMarkingRead(false); }
  };
  const closeNotifications = () => { setShowNotifications(false); notificationButtonRef.current?.focus(); };
  const notificationLink = item => {
    if (typeof item.link !== 'string' || !item.link.startsWith('/admin/') || item.link.length > 500) return '/admin/activity-log';
    try {
      const url = new URL(item.link, window.location.origin);
      return url.origin === window.location.origin && /^\/admin\/(?:quotations|invoices|calendar|post-production|crm|studio-projects|chats)(?:\/[a-zA-Z0-9_-]+)?$/.test(url.pathname) ? url.pathname + url.search + url.hash : '/admin/activity-log';
    } catch { return '/admin/activity-log'; }
  };
  const unread = notifications.filter(item => !item.isRead).length;
  const matches = destinations.filter(item => (item[0] + ' ' + item[2]).toLowerCase().includes(query.toLowerCase()));
  return <>
    <header className="studio-topbar" ref={panelRef}>
      <div className="studio-topbar-context"><button type="button" className="studio-menu-button studio-icon-button" aria-label="Open navigation" onClick={onMenuClick}><Menu size={21} /></button><span className="studio-topbar-workspace">Workspace</span><span className="studio-breadcrumb-separator" aria-hidden="true">/</span><strong>{active}</strong></div>
      <div className="studio-topbar-actions">
        <button type="button" className="studio-icon-button studio-theme-toggle" onClick={() => update({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} aria-label={preferences.theme === 'dark' ? 'Switch to Daylight mode' : 'Switch to Dark mode'} title={preferences.theme === 'dark' ? 'Daylight mode' : 'Dark mode'}>{preferences.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        <div className="studio-global-search"><Search size={16} /><input ref={searchInputRef} aria-label="Find a page" aria-controls="studio-page-results" aria-expanded={searchOpen} placeholder="Find a page…" value={query} onFocus={() => { setSearchOpen(true); setShowNotifications(false); }} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSearchOpen(true); panelRef.current?.querySelector('.studio-search-results a')?.focus(); } if (e.key === 'Enter' && matches[0]) { navigate(matches[0][1]); setSearchOpen(false); setQuery(''); } }} /><kbd className="studio-search-shortcut" aria-hidden="true">{searchShortcut}</kbd>
          {searchOpen && <div id="studio-page-results" className="studio-search-results" onKeyDown={event => { if (!['ArrowDown','ArrowUp'].includes(event.key)) return; const links = [...event.currentTarget.querySelectorAll('a')]; const index = links.indexOf(document.activeElement); if (index < 0) return; event.preventDefault(); links[(index + (event.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length]?.focus(); }}><p className="studio-search-label">Find a page</p>{matches.length ? matches.map(item => <Link to={item[1]} key={item[1]} onClick={() => { setSearchOpen(false); setQuery(''); }}>{item[0]}<ArrowUpRight size={14} /></Link>) : <p className="studio-muted">No matching pages.</p>}</div>}
        </div>
        <div className="studio-notification-wrap"><button type="button" className="studio-icon-button studio-notification-button" aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')} aria-expanded={showNotifications} aria-controls="studio-notifications" ref={notificationButtonRef} onClick={() => { setShowNotifications(value => !value); setSearchOpen(false); }}><Bell size={18} />{unread > 0 && <i />}</button>
          {showNotifications && <section className="studio-notification-panel" id="studio-notifications" aria-label="Notifications"><div className="studio-notification-heading"><h2>Notifications</h2><button type="button" className="studio-icon-button" aria-label="Close notifications" onClick={closeNotifications}><X size={16} /></button></div>{notificationError ? <p className="studio-empty">Activity is unavailable. Try again shortly.</p> : notifications.length ? <div className="studio-notification-list">{notifications.slice(0, 6).map(item => <Link key={item._id} to={notificationLink(item)} className={item.isRead ? '' : 'is-unread'} onClick={() => setShowNotifications(false)}><span className="studio-status-dot" /><div><strong>{item.title}</strong><p>{item.description}</p></div></Link>)}</div> : <p className="studio-empty">You’re all caught up.</p>}<div className="studio-notification-footer"><button type="button" onClick={markAll} disabled={!unread || markingRead}><CheckCheck size={14} /> {markingRead ? 'Marking…' : 'Mark all read'}</button><Link to="/admin/activity-log" onClick={() => setShowNotifications(false)}>View all <ArrowUpRight size={14} /></Link></div></section>}
        </div>
        <span className="studio-topbar-divider" /><button type="button" className="studio-profile-button" onClick={() => setShowProfile(true)} aria-label="Edit your profile"><span className="studio-avatar">{user?.firstName?.[0] || 'A'}{user?.lastName?.[0] || ''}</span></button>
      </div>
    </header>
    {showProfile && <AdminProfileModal profile={user} onClose={() => setShowProfile(false)} onSave={updated => { updateUser(updated); setShowProfile(false); toast.success('Profile updated'); }} />}
  </>;
}
