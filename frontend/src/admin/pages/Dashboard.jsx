import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ArrowUpRight, CalendarDays, MessageSquare, Folder, Clapperboard, MapPin, Check, RefreshCw, ArrowRight, CircleCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PipelineInsight, TaskLoadInsight } from '../components/operations/StudioInsights';

const API = import.meta.env.VITE_API_URL || '';
const dateFormat = (value, options) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(date) : 'Not set';
};
const statusClass = status => status === 'Converted' ? 'green' : ['Meeting', 'Negotiation'].includes(status) ? 'gold' : '';
const initials = name => name?.split(/\s+/).filter(part => /[a-zA-Z0-9]/.test(part)).slice(0, 2).map(part => part[0]).join('') || 'TA';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [completing, setCompleting] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await axios.get(API + '/api/dashboard/studio-overview', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, signal: controller.signal,
        });
        setOverview(result.data); setError('');
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (err.response?.status === 401) { logout(); return; }
        setError('Your studio data could not be loaded. Check the connection and try again.');
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refreshKey, logout]);

  const completeTask = async task => {
    setCompleting(task._id);
    try {
      await axios.patch(API + '/api/tasks/' + task._id, { status: 'completed' }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setRefreshKey(value => value + 1);
      toast.success('Task completed');
    } catch { toast.error('Could not complete the task. Please try again.'); }
    finally { setCompleting(null); }
  };
  const summary = overview?.summary || {};
  const today = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(today));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const metrics = [
    { title: 'Open enquiries', value: summary.openEnquiries, icon: MessageSquare, note: 'Across your active pipeline', path: '/admin/crm' },
    { title: 'Booked projects', value: summary.bookedProjects, icon: Folder, note: 'Accepted quotes and bookings', path: '/admin/studio-projects' },
    { title: 'Upcoming shoots', value: summary.upcomingEvents, icon: CalendarDays, note: 'Scheduled on your calendar', path: '/admin/calendar' },
    { title: 'Pending tasks', value: summary.pendingTasks, icon: Clapperboard, note: summary.overdueTasks ? summary.overdueTasks + ' need your attention' : 'Keep every delivery on track', path: '/admin/post-production' },
  ];
  const pipeline = overview?.pipeline || [];
  const total = pipeline.reduce((sum, item) => sum + item.count, 0);
  const conversion = total > 0 ? Math.round((summary.bookedProjects || 0) / total * 100) : 0;
  const events = overview?.upcomingEvents || [];
  const tasks = overview?.actionQueue || [];
  const enquiries = overview?.recentEnquiries || [];
  const emptyLabel = error ? 'Studio data is temporarily unavailable.' : overview ? 'Your studio is ready for its next story.' : 'Loading your studio…';

  return <div className="studio-overview">
    <div className="studio-page-heading">
      <div><span className="studio-eyebrow">YOUR STUDIO AT A GLANCE</span><h1>{greeting}, {user?.firstName || 'Team Alpha'}.</h1><p>Your studio at a glance.</p></div>
      <div className="studio-heading-actions"><Link to="/admin/calendar" className="studio-button"><CalendarDays size={14} />{dateFormat(today, { day: 'numeric', month: 'short', year: 'numeric' })}</Link><Link to="/admin/crm?new=1" className="studio-button primary"><Plus size={14} />New enquiry</Link></div>
    </div>
    {error && <div className="studio-error" role="alert"><span>{error}</span><button className="studio-button small" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={13} /> Retry</button></div>}
    <div className="studio-metric-grid">{metrics.map(metric => <Link to={metric.path} className="studio-metric" key={metric.title}><div className="studio-metric-top"><span>{metric.title}</span><span className="studio-metric-icon"><metric.icon size={14} strokeWidth={1.5} /></span></div><strong className="studio-metric-value">{metric.value ?? '—'}</strong><div className="studio-metric-foot">{metric.title === 'Pending tasks' && summary.overdueTasks > 0 ? <span>{metric.note}</span> : metric.note}<ArrowUpRight size={11} /></div></Link>)}</div>

    <div className="studio-overview-grid">
      <section className="studio-card"><div className="studio-card-heading"><div><h2>Enquiry pipeline</h2><p className="studio-card-subtitle">Current enquiry stages and bookings.</p></div><Link to="/admin/crm">View enquiries <ArrowUpRight size={12} /></Link></div>
        <div className="studio-pipeline-count"><strong>{overview ? total : '—'}</strong><span>total enquiries</span></div>
        <PipelineInsight pipeline={pipeline} loading={!overview} />
        <div className="studio-pipeline-footer"><span><strong>{overview ? conversion + '%' : '—'}</strong> enquiry to booking</span><Link to="/admin/studio-projects">View projects <ArrowRight size={12} /></Link></div>
      </section>
      <section className="studio-card"><div className="studio-card-heading"><h2>Needs your attention <span className="studio-inline-count">{summary.pendingTasks ?? '—'}</span></h2><Link to="/admin/post-production">All tasks <ArrowUpRight size={12} /></Link></div>
        {overview && <TaskLoadInsight pending={summary.pendingTasks || 0} overdue={summary.overdueTasks || 0} />}
        <div className="studio-task-list">{tasks.length ? tasks.slice(0, 4).map(task => {
          const overdue = task.dueDate && new Date(task.dueDate) < today;
          return <div className="studio-task-row" key={task._id}><button className="studio-task-check" aria-label={'Complete task: ' + task.title} onClick={() => completeTask(task)} disabled={completing === task._id}><Check size={11} /></button><div><h3>{task.title}</h3><p>{task.lead?.name || 'Studio task'}</p></div><span className={'studio-task-due' + (overdue ? ' overdue' : '')}>{overdue ? 'Overdue' : task.dueDate ? dateFormat(task.dueDate, { day: 'numeric', month: 'short' }) : 'No due date'}</span></div>;
        }) : <div className="studio-empty"><CircleCheck size={24} />{overview && !error ? 'You’re all caught up. Beautiful work.' : emptyLabel}</div>}</div>
      </section>
    </div>

    <section className="studio-card" style={{ marginBottom: 21 }}><div className="studio-card-heading"><div><h2>Upcoming events</h2><p className="studio-card-subtitle">Your next shoots and meetings.</p></div><Link to="/admin/calendar">Open calendar <ArrowUpRight size={12} /></Link></div>
      {events.length ? <div className="studio-shoot-grid">{events.slice(0, 3).map(event => <Link to="/admin/calendar" className="studio-shoot-card" key={event._id}><div className="studio-shoot-date"><small>{dateFormat(event.start, { month: 'short' })}</small><strong>{dateFormat(event.start, { day: 'numeric' })}</strong></div><div className="studio-shoot-detail"><h3>{event.title}</h3><p><MapPin size={10} /><span>{event.location || 'Location to be confirmed'}</span></p><span className="studio-badge gold">{event.type || 'Shoot'}</span></div></Link>)}</div> : <p className="studio-empty">{overview && !error ? 'No upcoming shoots. Add the next one to your calendar.' : emptyLabel}</p>}
    </section>

    <section className="studio-card"><div className="studio-card-heading"><div><h2>Recent enquiries</h2><p className="studio-card-subtitle">The latest clients and project enquiries.</p></div><Link to="/admin/crm">View all <ArrowUpRight size={12} /></Link></div>
      {enquiries.length ? <div className="studio-table-wrap"><table className="studio-table"><thead><tr><th>Client</th><th>Celebration</th><th>Event date</th><th>Stage</th><th aria-label="View enquiry" /></tr></thead><tbody>{enquiries.slice(0, 4).map(lead => <tr key={lead._id}><td><Link to="/admin/crm" className="studio-client-cell"><span className="studio-client-initials">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>Added {dateFormat(lead.createdAt, { day: 'numeric', month: 'short' })}</small></div></Link></td><td>{lead.eventType || 'To be discussed'}</td><td>{dateFormat(lead.eventDate, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><span className={'studio-badge ' + statusClass(lead.status)}>{lead.status === 'Converted' ? 'Booked' : lead.status}</span></td><td><Link to="/admin/crm" className="studio-icon-button" aria-label={'View ' + lead.name + ' enquiry'}><ArrowUpRight size={14} /></Link></td></tr>)}</tbody></table></div> : <p className="studio-empty">{overview && !error ? 'Your next enquiry will appear here.' : emptyLabel}</p>}
    </section>
    <div className="studio-data-note"><span className={'studio-status-dot' + (error ? ' offline' : '')} />{error ? 'Connection interrupted' : overview ? 'Connected to your studio' : 'Connecting to your studio'}{overview && <span>Last updated {dateFormat(overview.generatedAt, { hour: 'numeric', minute: '2-digit' })} IST</span>}<button onClick={() => setRefreshKey(value => value + 1)} aria-label="Refresh studio overview"><RefreshCw size={11} /></button></div>
  </div>;
}
