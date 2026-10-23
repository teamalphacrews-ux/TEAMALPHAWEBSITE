import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ArrowUpRight, CalendarDays, MessageSquare, Folder, Clapperboard, MapPin, Check, RefreshCw, ArrowRight, CircleCheck, FileText, Wallet, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PipelineInsight, TaskLoadInsight } from '../components/operations/StudioInsights';
import StudioAppIcon from '../components/common/StudioAppIcon';

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
    { title: 'Open enquiries', value: summary.openEnquiries, icon: MessageSquare, tone: 'blue', note: 'In your active pipeline', path: '/admin/crm' },
    { title: 'Booked projects', value: summary.bookedProjects, icon: Folder, tone: 'indigo', note: 'Confirmed client projects', path: '/admin/studio-projects' },
    { title: 'Upcoming events', value: summary.upcomingEvents, icon: CalendarDays, tone: 'rose', note: 'Shoots, meetings and more', path: '/admin/calendar' },
    { title: 'Pending tasks', value: summary.pendingTasks, icon: Clapperboard, tone: 'amber', note: summary.overdueTasks ? summary.overdueTasks + ' overdue' : 'No overdue tasks', alert: summary.overdueTasks > 0, path: '/admin/post-production' },
  ];
  const pipeline = overview?.pipeline || [];
  const total = pipeline.reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0);
  const bookedEnquiries = Math.max(0, Number(pipeline.find(item => item.status === 'Converted')?.count) || 0);
  const conversion = total > 0 ? Math.round(bookedEnquiries / total * 100) : null;
  const events = overview?.upcomingEvents || [];
  const tasks = overview?.actionQueue || [];
  const enquiries = overview?.recentEnquiries || [];
  const emptyLabel = error ? 'Studio data is temporarily unavailable.' : 'Loading your studio…';
  const quickActions = [
    { title: 'Quotations', note: 'Prepare and manage proposals', icon: FileText, tone: 'amber', path: '/admin/quotations' },
    { title: 'Finance', note: 'Invoices, payments and expenses', icon: Wallet, tone: 'green', path: '/admin/finance' },
    { title: 'Production', note: 'Plan your next delivery', icon: Clapperboard, tone: 'violet', path: '/admin/projects' },
  ];

  return (
    <div className="studio-overview studio-overview-modern">
      <div className="studio-page-heading studio-overview-header">
        <div>
          <div className="studio-overview-meta"><span className={'studio-command-status' + (error ? ' has-error' : !overview ? ' is-connecting' : '')} aria-live="polite"><span aria-hidden="true" />{error ? 'Connection interrupted' : overview ? 'Studio connected' : 'Connecting'}</span><span>{dateFormat(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          <h1>Overview</h1>
          <p className="studio-overview-lede">{greeting}, {user?.firstName || 'Team Alpha'}. Here’s what’s happening in your studio.</p>
        </div>
        <div className="studio-heading-actions">
          <Link to="/admin/calendar" className="studio-button"><CalendarDays size={16} />Open calendar</Link>
          <Link to="/admin/crm?new=1" className="studio-button primary"><Plus size={16} />New enquiry</Link>
        </div>
      </div>

      {error && <div className="studio-error" role="alert"><span>{error}</span><button className="studio-button small" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={14} />Retry</button></div>}

      <div className="studio-metric-grid" aria-label="Studio summary" aria-busy={!overview && !error}>
        {metrics.map(metric => (
          <Link to={metric.path} className="studio-metric" key={metric.title}>
            <div className="studio-metric-top"><span>{metric.title}</span><StudioAppIcon icon={metric.icon} tone={metric.tone} size={40} /></div>
            <strong className="studio-metric-value">{metric.value ?? '—'}</strong>
            <div className={'studio-metric-foot' + (metric.alert ? ' studio-metric-alert' : '')}><span>{overview ? metric.note : 'Awaiting studio data'}</span><ArrowUpRight size={14} /></div>
          </Link>
        ))}
      </div>

      <div className="studio-overview-grid studio-overview-main">
        <section className="studio-card studio-schedule-card" aria-labelledby="overview-events-title">
          <div className="studio-card-heading">
            <div><h2 id="overview-events-title">Upcoming events</h2><p className="studio-card-subtitle">Your next shoots and meetings · IST</p></div>
            <Link to="/admin/calendar">View calendar<ArrowUpRight size={14} /></Link>
          </div>
          {events.length ? (
            <div className="studio-schedule-list">
              {events.slice(0, 4).map(event => (
                <Link to="/admin/calendar" className="studio-schedule-row" key={event._id}>
                  <div className="studio-shoot-date"><small>{dateFormat(event.start, { month: 'short' })}</small><strong>{dateFormat(event.start, { day: 'numeric' })}</strong></div>
                  <div className="studio-shoot-detail"><h3>{event.title}</h3><p><MapPin size={13} /><span>{event.location || 'Location to be confirmed'}</span></p></div>
                  <div className="studio-schedule-time"><span>{dateFormat(event.start, { weekday: 'long' })}</span><small>{event.type || 'Event'}</small></div>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : <div className="studio-empty"><CalendarDays size={26} /><span>{overview && !error ? 'No upcoming events. Add your next shoot or meeting.' : emptyLabel}</span>{overview && !error && <Link to="/admin/calendar" className="studio-button small">Open calendar<ArrowRight size={14} /></Link>}</div>}
        </section>

        <section className="studio-card studio-action-card" aria-labelledby="overview-tasks-title">
          <div className="studio-card-heading"><div><h2 id="overview-tasks-title">Action queue<span className="studio-inline-count">{summary.pendingTasks ?? '—'}</span></h2><p className="studio-card-subtitle">Your pending production tasks.</p></div><Link to="/admin/post-production">View all<ArrowUpRight size={14} /></Link></div>
          {overview && <TaskLoadInsight pending={summary.pendingTasks || 0} overdue={summary.overdueTasks || 0} />}
          <div className="studio-task-list">
            {tasks.length ? tasks.slice(0, 4).map(task => {
              const overdue = task.dueDate && new Date(task.dueDate) < today;
              return (
                <div className="studio-task-row" key={task._id}>
                  <button className="studio-task-check" aria-label={'Complete task: ' + task.title} onClick={() => completeTask(task)} disabled={completing === task._id}>{completing === task._id ? <RefreshCw size={13} /> : <Check size={13} />}</button>
                  <div><h3>{task.title}</h3><p>{task.lead?.name || 'Studio task'}</p></div>
                  <span className={'studio-task-due' + (overdue ? ' overdue' : '')}>{overdue ? 'Overdue' : task.dueDate ? dateFormat(task.dueDate, { day: 'numeric', month: 'short' }) : 'No due date'}</span>
                </div>
              );
            }) : <div className="studio-empty"><CircleCheck size={26} /><span>{overview && !error ? 'You’re all caught up. No pending tasks.' : emptyLabel}</span></div>}
          </div>
        </section>
      </div>

      <div className="studio-overview-grid studio-overview-secondary">
        <section className="studio-card studio-pipeline-card" aria-labelledby="overview-pipeline-title">
          <div className="studio-card-heading"><div><h2 id="overview-pipeline-title">Enquiry pipeline</h2><p className="studio-card-subtitle">Every enquiry, from first contact to booking.</p></div><Link to="/admin/crm">View all<ArrowUpRight size={14} /></Link></div>
          <div className="studio-pipeline-count"><strong>{overview ? total : '—'}</strong><span>total enquiries</span></div>
          <PipelineInsight pipeline={pipeline} loading={!overview} />
          <div className="studio-pipeline-footer"><span><strong>{overview && conversion !== null ? conversion + '%' : '—'}</strong> enquiry to booking</span><Link to="/admin/studio-projects">Projects<ArrowRight size={14} /></Link></div>
        </section>

        <section className="studio-card studio-recent-card" aria-labelledby="overview-enquiries-title">
          <div className="studio-card-heading"><div><h2 id="overview-enquiries-title">Recent enquiries</h2><p className="studio-card-subtitle">The latest conversations with your studio.</p></div><Link to="/admin/crm">View all<ArrowUpRight size={14} /></Link></div>
          {enquiries.length ? (
            <div className="studio-table-wrap"><table className="studio-table studio-overview-enquiry-table"><thead><tr><th scope="col">Client</th><th scope="col">Event</th><th scope="col">Stage</th><th scope="col" aria-label="View enquiry" /></tr></thead><tbody>
              {enquiries.slice(0, 4).map(lead => (
                <tr key={lead._id}>
                  <td><Link to="/admin/crm" className="studio-client-cell"><span className="studio-client-initials" aria-hidden="true">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>Added {dateFormat(lead.createdAt, { day: 'numeric', month: 'short' })}</small></div></Link></td>
                  <td><div className="studio-overview-event-cell"><span>{lead.eventType || 'To be discussed'}</span><small>{dateFormat(lead.eventDate, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div></td>
                  <td><span className={'studio-badge ' + statusClass(lead.status)}>{lead.status === 'Converted' ? 'Booked' : lead.status}</span></td>
                  <td><Link to="/admin/crm" className="studio-icon-button" aria-label={'View ' + lead.name + ' enquiry'}><ArrowUpRight size={16} /></Link></td>
                </tr>
              ))}
            </tbody></table></div>
          ) : <div className="studio-empty"><MessageSquare size={26} /><span>{overview && !error ? 'Your next enquiry will appear here.' : emptyLabel}</span>{overview && !error && <Link to="/admin/crm?new=1" className="studio-button small"><Plus size={14} />New enquiry</Link>}</div>}
        </section>
      </div>

      <nav className="studio-quick-actions" aria-label="Quick access">
        {quickActions.map(action => <Link to={action.path} className="studio-quick-action" key={action.path}><StudioAppIcon icon={action.icon} tone={action.tone} size={40} /><span><strong>{action.title}</strong><small>{action.note}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}
      </nav>

      <div className="studio-data-note"><span className={'studio-status-dot' + (error ? ' offline' : '')} />{error ? 'Connection interrupted' : overview ? 'Connected to your studio' : 'Connecting to your studio'}{overview && <span>Last updated {dateFormat(overview.generatedAt, { hour: 'numeric', minute: '2-digit' })} IST</span>}<button onClick={() => setRefreshKey(value => value + 1)} aria-label="Refresh studio overview"><RefreshCw size={14} /></button></div>
    </div>
  );
}
