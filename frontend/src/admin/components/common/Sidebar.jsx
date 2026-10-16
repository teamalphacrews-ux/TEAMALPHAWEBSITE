import { useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUnreadCounts, setAdminUnreadCount, handleRoomUpdate } from '../../../store/slices/chatSlice';
import { io } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { LayoutDashboard, UsersRound, Images, Wallet, CalendarDays, X, LogOut, MessageSquare, Bell, Settings2, FolderHeart, Clapperboard, ArrowUpRight, Aperture, Webhook, FileText, HardDrive, UserRound } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';
const groups = [
  { label: 'WORKSPACE', items: [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Enquiries', path: '/admin/crm', icon: MessageSquare },
    { name: 'Quotations', path: '/admin/quotations', icon: FileText },
    { name: 'Projects', path: '/admin/projects', icon: FolderHeart },
    { name: 'Crew & scheduling', path: '/admin/crew', icon: UsersRound },
    { name: 'Post production', path: '/admin/post-production', icon: Clapperboard },
    { name: 'Calendar', path: '/admin/calendar', icon: CalendarDays },
  ]},
  { label: 'STUDIO', items: [
    { name: 'Clients', path: '/admin/clients', icon: UserRound },
    { name: 'Data & backups', path: '/admin/data', icon: HardDrive },
    { name: 'Client galleries', path: '/admin/gallery', icon: Images },
    { name: 'Finances', path: '/admin/finance', icon: Wallet },
    { name: 'Conversations', path: '/admin/chats', icon: MessageSquare },
    { name: 'Activity', path: '/admin/activity-log', icon: Bell },
    { name: 'Integrations', path: '/admin/integrations', icon: Webhook },
    { name: 'Settings', path: '/admin/settings', icon: Settings2 },
    { name: 'Team & access', path: '/admin/users', icon: Settings2 },
  ]},
];

export default function Sidebar({ onClose }) {
  const { user, token, logout } = useAuth();
  const dispatch = useDispatch();
  const unreadCount = useSelector(state => state.chat.adminUnreadCount);
  useEffect(() => {
    if (!user || !token) return;
    const socket = io(API_URL, { auth: { token }, reconnectionAttempts: 3 });
    socket.on('connect', () => { socket.emit('join_chat', 'admin'); dispatch(fetchUnreadCounts()); });
    socket.on('room_updated', data => dispatch(handleRoomUpdate(data)));
    socket.on('unread_count_update', data => { if (typeof data?.count === 'number') dispatch(setAdminUnreadCount(data.count)); });
    dispatch(fetchUnreadCounts());
    return () => socket.disconnect();
  }, [user, token, dispatch]);

  return <aside className="studio-sidebar" aria-label="Studio navigation">
    <div className="studio-brand-row">
      <Link to="/admin" className="studio-brand" onClick={onClose} aria-label="Team Alpha Studio OS home">
        <span className="studio-brand-mark"><Aperture size={27} strokeWidth={1.2} /></span>
        <span><strong>TEAM ALPHA</strong><small>STUDIO OS</small></span>
      </Link>
      <button className="studio-nav-close" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
    </div>
    <div className="studio-workspace-label"><span className="studio-status-dot" /> Your private studio <span>01</span></div>
    <nav className="studio-nav">{groups.map(group => <div className="studio-nav-group" key={group.label}>
      <p className="studio-nav-label">{group.label}</p>
      {group.items.map(item => <NavLink key={item.path} to={item.path} end={item.exact} onClick={onClose} className={({ isActive }) => 'studio-nav-item' + (isActive ? ' is-active' : '')}>
        <item.icon size={17} strokeWidth={1.6} /><span>{item.name}</span>
        {item.path === '/admin/chats' && unreadCount > 0 && <span className="studio-nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </NavLink>)}
    </div>)}</nav>
    <div className="studio-sidebar-bottom">
      <Link to="/" className="studio-portfolio-link"><span>Visit your website</span><ArrowUpRight size={16} /></Link>
      <div className="studio-sidebar-profile"><span className="studio-avatar">{user?.firstName?.[0] || 'A'}{user?.lastName?.[0] || ''}</span><div><strong>{user?.firstName || 'Studio'} {user?.lastName || ''}</strong><small>Studio administrator</small></div><button aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={17} /></button></div>
    </div>
  </aside>;
}
