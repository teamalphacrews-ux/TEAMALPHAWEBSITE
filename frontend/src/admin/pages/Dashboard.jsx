import StudioButton from '../components/common/StudioButton';
import { Fragment, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ArrowUpRight, CalendarDays, MessageSquare, Folder, Clapperboard, Check, RefreshCw, ArrowRight, CircleCheck, FileText, Wallet, ChevronRight, GripVertical, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StudioAppIcon from '../components/common/StudioAppIcon';
import { useStudioPreferences } from '../components/common/StudioPreferences';
import OverviewCustomizer from '../components/common/OverviewCustomizer';
import OverviewFinanceCard from '../components/finance/OverviewFinanceCard';
import { useStudioIdentity } from '../../utils/studioIdentity';
import { formatWorkspaceDate, formatWorkspaceTime, formatWorkspaceNumber, resolveWorkspaceTimezone } from '../../utils/workspaceLocale';
import { studioText } from '../../utils/studioTranslations';
import { dashboardWork, taskIsOverdue } from '../../utils/dashboardData';
import { recordDestination } from '../../utils/studioNavigation';
import { OverviewWelcome, BookingInsight, RhythmInsight, ActivityInsight, PipelineRings, WeekStrip } from '../components/overview/OverviewInsights';
import OverviewDaySchedule from '../components/overview/OverviewDaySchedule';
import './overviewDashboard.css';
import './overviewReference.css';
import './overviewPhone.css';

const API = import.meta.env.VITE_API_URL || '';
const statusClass = status => status === 'Converted' ? 'green' : ['Meeting', 'Negotiation'].includes(status) ? 'gold' : '';
const initials = name => name?.split(/\s+/).filter(part => /[a-zA-Z0-9]/.test(part)).slice(0, 2).map(part => part[0]).join('') || 'TA';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { preferences, toggleCard, resetCards, update } = useStudioPreferences();
  const { identity } = useStudioIdentity();
  const timezone = resolveWorkspaceTimezone(preferences, identity?.timezone);
  const t = text => studioText(preferences.language, text);
  const dateFormat = (value, options) => formatWorkspaceDate(value, preferences, identity?.timezone, options);
  const timeFormat = value => formatWorkspaceTime(value, preferences, identity?.timezone);
  const [customizing, setCustomizing] = useState(false);
  const remove = (id, label) => <button type="button" className="overview-hide-card" aria-label={'Hide ' + label + ' card'} title="Hide card" onClick={() => toggleCard(id)}><X size={13} /></button>;
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [ideaRevision, setIdeaRevision] = useState(0);
  const refreshOverview = () => { setRefreshKey(value => value + 1); setIdeaRevision(value => value + 1); };
  const [completing, setCompleting] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await axios.get(API + '/api/dashboard/studio-overview', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, signal: controller.signal, params: { timezone },
        });
        // Keep an already-running sample server usable without resetting its temporary records.
        // Production insights always come from the workspace-scoped backend aggregates.
        if (import.meta.env.DEV && user?.isPreview && !result.data.insights) {
          try {
            const headers = { Authorization: 'Bearer ' + localStorage.getItem('token') };
            const [leads, tasks, events, { buildPreviewOverviewInsights }] = await Promise.all([
              axios.get(API + '/api/leads', { headers, signal: controller.signal }),
              axios.get(API + '/api/tasks', { headers, signal: controller.signal }),
              axios.get(API + '/api/calendar', { headers, signal: controller.signal }),
              import('../../utils/previewOverviewInsights.js'),
            ]);
            const now = new Date();
            result.data.insights = buildPreviewOverviewInsights({ leads: leads.data, tasks: tasks.data, events: events.data, now, timezone });
            if (Array.isArray(tasks.data)) result.data.summary.overdueTasks = tasks.data.filter(task => task.status === 'pending' && taskIsOverdue(task, now, timezone)).length;
          } catch (previewError) {
            if (axios.isCancel(previewError)) return;
            // An unavailable sample list must not turn a working overview into an error.
          }
        }
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
  }, [refreshKey, logout, timezone, user?.isPreview]);

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
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(today));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const metrics = [
    { id: 'openEnquiries', title: 'Open enquiries', value: summary.openEnquiries, icon: MessageSquare, tone: 'blue', note: 'In your active pipeline', path: '/admin/crm' },
    { id: 'bookedProjects', title: 'Booked projects', value: summary.bookedProjects, icon: Folder, tone: 'indigo', note: 'Confirmed client projects', path: '/admin/studio-projects' },
    { id: 'upcomingEvents', title: 'Upcoming events', value: summary.upcomingEvents, icon: CalendarDays, tone: 'rose', note: 'Shoots, meetings and more', path: '/admin/calendar' },
    { id: 'pendingTasks', title: 'Pending tasks', value: summary.pendingTasks, icon: Clapperboard, tone: 'amber', note: summary.overdueTasks ? summary.overdueTasks + ' overdue' : 'No overdue tasks', alert: summary.overdueTasks > 0, path: '/admin/post-production' },
  ];
  const pipeline = overview?.pipeline || [];
  const total = pipeline.reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0);
  const bookedEnquiries = Math.max(0, Number(pipeline.find(item => item.status === 'Converted')?.count) || 0);
  const conversion = total > 0 ? Math.round(bookedEnquiries / total * 100) : null;
  const work = dashboardWork(overview?.upcomingEvents, overview?.actionQueue, today, timezone);
  const tasks = work.tasks;
  const enquiries = overview?.recentEnquiries || [];
  const emptyLabel = error ? 'Studio data is temporarily unavailable.' : 'Loading your studio…';
  const quickActions = [
    { title: 'Quotations', note: 'Prepare and manage proposals', icon: FileText, tone: 'amber', path: '/admin/quotations' },
    { title: 'Finance', note: 'Invoices, payments and expenses', icon: Wallet, tone: 'green', path: '/admin/finance' },
    { title: 'Production', note: 'Plan your next delivery', icon: Clapperboard, tone: 'violet', path: '/admin/projects' },
  ];

  const cardContent = {
    ...Object.fromEntries(metrics.map(metric => [metric.id, <div className="studio-metric overview-stat" data-overview-card={metric.id}><Link to={metric.path} className="overview-stat-content">
            <div className="studio-metric-top"><span lang={preferences.language} dir="auto">{t(metric.title)}</span><StudioAppIcon icon={metric.icon} tone={metric.tone} size={40} /></div>
            <strong className="studio-metric-value">{formatWorkspaceNumber(metric.value, preferences)}</strong>
            <div className={'studio-metric-foot' + (metric.alert ? ' studio-metric-alert' : '')}><span>{overview ? metric.note : 'Awaiting studio data'}</span><ArrowUpRight size={14} /></div>
          </Link>{remove(metric.id, metric.title)}</div>])),
    bookingMomentum: <BookingInsight insights={overview?.insights} loading={!overview && !error} conversion={conversion} total={total} booked={bookedEnquiries} remove={remove('bookingMomentum', 'Booking momentum')} />,
    productionPulse: <RhythmInsight insights={overview?.insights} loading={!overview && !error} remove={remove('productionPulse', 'Studio rhythm')} />,
    activityMap: <ActivityInsight insights={overview?.insights} loading={!overview && !error} remove={remove('activityMap', 'Activity map')} />,
    upcomingSchedule: <OverviewDaySchedule timezone={timezone} preferences={preferences} refreshKey={refreshKey} remove={remove('upcomingSchedule', 'Upcoming schedule')} />,
    actionQueue: (<section className="studio-card studio-action-card overview-workspace-card" aria-labelledby="overview-tasks-title" data-overview-card="actionQueue">{remove('actionQueue', 'Action queue')}
          <div className="studio-card-heading"><div><h3 id="overview-tasks-title" lang={preferences.language} dir="auto">{t('Action queue')}<span className="studio-inline-count">{summary.pendingTasks ?? '—'}</span></h3><p className="studio-card-subtitle">{work.overdueTasks ? work.overdueTasks + ' overdue. Start with the earliest deadline.' : 'Your next tasks, ordered by deadline.'}</p></div><Link to="/admin/post-production">View all<ArrowUpRight size={14} /></Link></div>

          <div className="studio-task-list">
            {tasks.length ? tasks.slice(0, 4).map(task => {
              const overdue = taskIsOverdue(task, today, timezone);
              return (
                <div className="studio-task-row" key={task._id}>
                  <StudioButton type="button" variant="icon" className="studio-task-check" icon={Check} label={'Complete task: ' + task.title} loading={completing === task._id} loadingLabel={'Completing task: ' + task.title} onClick={() => completeTask(task)} />
                  <div><h3><Link to={task.lead?._id ? recordDestination('enquiry', task.lead._id) : '/admin/post-production'}>{task.title}</Link></h3><p>{task.lead?.name || 'Studio task'}</p></div>
                  <span className={'studio-task-due' + (overdue ? ' overdue' : '')}>{overdue ? 'Overdue' : task.dueDate ? dateFormat(task.dueDate, { day: 'numeric', month: 'short' }) : 'No due date'}</span>
                </div>
              );
            }) : <div className="studio-empty"><CircleCheck size={26} /><span>{overview && !error ? 'You’re all caught up. No pending tasks.' : emptyLabel}</span></div>}
          </div>
        </section>),
    enquiryPipeline: <PipelineRings pipeline={pipeline} loading={!overview} remove={remove('enquiryPipeline', 'Pipeline performance')} />,
    recentEnquiries: (<section className="studio-card studio-recent-card overview-workspace-card" aria-labelledby="overview-enquiries-title" data-overview-card="recentEnquiries">{remove('recentEnquiries', 'Recent enquiries')}
          <div className="studio-card-heading"><div><h3 id="overview-enquiries-title" lang={preferences.language} dir="auto">{t('Recent enquiries')}</h3><p className="studio-card-subtitle">The latest conversations with your studio.</p></div><Link to="/admin/crm">View all<ArrowUpRight size={14} /></Link></div>
          {enquiries.length ? (
            <ul className="overview-enquiry-list">
              {enquiries.slice(0, 4).map(lead => (
                <li key={lead._id}><Link to={recordDestination('enquiry', lead._id)} className="overview-enquiry-row">
                  <span className="studio-client-initials" aria-hidden="true">{initials(lead.name)}</span>
                  <span className="overview-enquiry-person"><strong>{lead.name}</strong><small>{lead.eventType || 'To be discussed'} · {dateFormat(lead.eventDate)}</small><small className="overview-enquiry-added">Added {dateFormat(lead.createdAt, { day: 'numeric', month: 'short' })}</small></span>
                  <span className={'studio-badge ' + statusClass(lead.status)}>{lead.status === 'Converted' ? 'Booked' : lead.status}</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link></li>
              ))}
            </ul>
          ) : <div className="studio-empty"><MessageSquare size={26} /><span>{overview && !error ? 'Your next enquiry will appear here.' : emptyLabel}</span>{overview && !error && <Link to="/admin/crm?new=1" className="studio-button small"><Plus size={14} />{t('New enquiry')}</Link>}</div>}
        </section>),
    quickActions: (<div className="overview-quick-wrapper" data-overview-card="quickActions">{remove('quickActions', 'Quick access')}<nav className="studio-quick-actions" aria-label="Quick access">
        {quickActions.map(action => <Link to={action.path} className="studio-quick-action" key={action.path}><StudioAppIcon icon={action.icon} tone={action.tone} size={40} /><span><strong>{t(action.title)}</strong><small>{action.note}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}
      </nav></div>),
    financePulse: (<OverviewFinanceCard refreshKey={refreshKey} motionActive={true} remove={remove('financePulse', 'Finance pulse')} />),
  };

  const savedOrder = preferences.cardOrder.filter(id => preferences.visibleCards.includes(id) && cardContent[id]);
  const todayMode = preferences.overviewMode === 'today';
  const overviewContext = todayMode && overview
    ? `${work.todayEvents} ${work.todayEvents === 1 ? 'event' : 'events'} today · ${work.overdueTasks} overdue ${work.overdueTasks === 1 ? 'task' : 'tasks'}`
    : dateFormat(today, { weekday: 'long', day: 'numeric', month: 'short' });
  const visibleOrder = todayMode ? ['upcomingSchedule','actionQueue','financePulse','recentEnquiries','quickActions'].filter(id=>savedOrder.includes(id)) : savedOrder;
  const displayOrder=todayMode?['upcomingSchedule','actionQueue','financePulse','recentEnquiries','inspiration','quickActions'].filter(id=>id==='inspiration'?preferences.showInspiration:visibleOrder.includes(id)):[...(preferences.showInspiration?['inspiration']:[]),...visibleOrder];
  const welcome=<div className={'ov-welcome-slot' + (visibleOrder[0] === 'upcomingSchedule' ? '' : ' is-wide')}><OverviewWelcome key={ideaRevision} name={user?.firstName || identity?.name || 'your studio'} greeting={greeting} date={dateFormat(today, { day: 'numeric', month: 'short', year: 'numeric' })} todayCount={overview ? work.todayEvents : null} pending={summary.pendingTasks} /></div>;
  const lastInsight = visibleOrder.filter(id => ['bookingMomentum', 'productionPulse', 'activityMap', 'enquiryPipeline'].includes(id)).at(-1);
  return (
    <div className="studio-overview studio-overview-modern overview-organized studio-overview-reference overview-phone-refined">
      <div className="ov-page-toolbar"><div><span className="ov-page-eyebrow">YOUR CREATIVE WORKSPACE</span><h1>Studio overview</h1><p className="ov-page-context">{overviewContext}</p></div></div>
      {error && <div className="studio-error" role="alert"><span>{error}</span><button className="studio-button small" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={14} />Retry</button></div>}
      <div className="ov-view-controls"><div role="group" aria-label="Overview view"><button type="button" aria-pressed={todayMode} onClick={()=>update({overviewMode:'today'})}>Today</button><button type="button" aria-pressed={!todayMode} onClick={()=>update({overviewMode:'insights'})}>Insights</button></div><div className="ov-view-tools"><Link className="studio-button ov-shoot-day-link" to="/admin/shoot-day" aria-label="Open Shoot day" title="Shoot day"><CalendarDays size={15}/><span>Shoot day</span></Link><button type="button" className="studio-button ov-customize-button" aria-label="Customize overview" title="Customize overview" onClick={() => setCustomizing(true)}><GripVertical size={17}/><span>Customize</span></button></div></div>
      <div className={'ov-reference-grid'+(todayMode?' is-today':'')}>
        {displayOrder.map(id => id==='inspiration'?<Fragment key={id}>{welcome}</Fragment>:<Fragment key={id}><div className={'ov-reference-slot ov-slot-' + id}>{cardContent[id]}</div>{!todayMode && preferences.showActivityStreak && id === lastInsight && <div className="ov-week-slot"><WeekStrip insights={overview?.insights} /></div>}</Fragment>)}
      </div>

      {!visibleOrder.length && <div className="studio-card overview-empty"><Sparkles size={24} /><h2>{preferences.visibleCards.length ? 'Choose your daily workspace.' : 'Make room for what matters.'}</h2><p>{preferences.visibleCards.length ? 'Your saved cards are in Insights. Add a schedule or action queue for Today.' : 'Add the cards you need, or restore the default layout.'}</p><div><button type="button" className="studio-button" onClick={() => setCustomizing(true)}>Choose cards</button>{preferences.visibleCards.length ? <button type="button" className="studio-button primary" onClick={() => update({ overviewMode: 'insights' })}>View Insights</button> : <button type="button" className="studio-button primary" onClick={resetCards}>Reset to default</button>}</div></div>}
      {customizing && <OverviewCustomizer onClose={() => setCustomizing(false)} />}

      <div className="studio-data-note"><span className={'studio-status-dot' + (error ? ' offline' : '')} />{error ? 'Connection interrupted' : overview ? 'Connected to your studio' : 'Connecting to your studio'}{overview && <span>Last updated {timeFormat(overview.generatedAt)} {timezone}</span>}<StudioButton type="button" variant="icon" icon={RefreshCw} label="Refresh studio overview" onClick={refreshOverview} /></div>
    </div>
  );
}
