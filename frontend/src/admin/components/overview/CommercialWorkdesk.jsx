import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Check, Folder, MessageSquare, Plus, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { formatWorkspaceNumber } from '../../../utils/workspaceLocale';
import { studioDayKey } from '../../../utils/studioTime';
import { operationAPI } from '../operations/operationsUtils';
import { WorkspaceActionMenu } from '../operations/WorkspaceActionMenu';
import OverviewDaySchedule from './OverviewDaySchedule';
import WorkloadPlot from './WorkloadPlot';
import WorkdeskNumber from './WorkdeskNumber';
import WorkspaceMotionTitle from '../common/WorkspaceMotionTitle';
import { taskGroups, taskBreakdown, projectBreakdown, enquiryBreakdown, sessionBreakdown, workBuckets } from './workdeskStats';
import './commercialWorkdesk.css';

export function WorkdeskHeader({ greeting, name, today, date, context, todayMode, chooseView, onCustomize, canCreateTask }) {
  const navigate = useNavigate();
  const title = todayMode ? greeting + ', ' + name : 'Studio insights';
  return <header className="sx-desk-header">
    <div><time dateTime={today}>{date(today, { weekday: 'long', day: 'numeric', month: 'long' })}</time>
      <WorkspaceMotionTitle>{title}</WorkspaceMotionTitle>{context && <p>{context}</p>}</div>
    <div className="sx-desk-tools">
      <WorkspaceActionMenu label={<><SlidersHorizontal size={15} /> View options</>} ariaLabel="Overview options" hideChevron className="sx-desk-options">
        <button onClick={() => chooseView(todayMode ? 'insights' : 'today')}>{todayMode ? 'View Insights' : 'View Today'}</button>
        <button aria-haspopup="dialog" onClick={onCustomize}>Customize overview</button>
        <button onClick={() => navigate('/admin/shoot-day')}>Open Shoot day</button>
      </WorkspaceActionMenu>
      {canCreateTask && <Link className="sx-desk-new" to="/admin/post-production?new=1"><Plus size={16}/>New task</Link>}
    </div>
  </header>;
}

function useWorkdeskList(endpoint, enabled, token, refreshKey, retry) {
  const [records, setRecords] = useState();
  useEffect(() => {
    if (!enabled || !token) return;
    const controller = new AbortController();
    let fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      try {
        const response = await axios.get(operationAPI + endpoint, {
          signal: controller.signal,
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!controller.signal.aborted) setRecords(Array.isArray(response.data) ? response.data : null);
      } catch {
        if (!controller.signal.aborted) setRecords(null);
      } finally {
        fetching = false;
      }
    }
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [endpoint, enabled, token, refreshKey, retry]);
  return records;
}

const sum = values => values.reduce((total, value) => total + value, 0);
const stageLabels = ['Done', 'Moving', 'Waiting'];

function WorkSummary({ rows, format, numberFormat, retry }) {
  if (!rows.length) return null;
  return <section className="sx-desk-card sx-desk-work" aria-labelledby="desk-work-heading">
    <header className="sx-desk-card-head">
      <div><h2 id="desk-work-heading">Where the work stands</h2><p>Status across your studio’s work</p></div>
      <ul className="sx-desk-key" aria-label="Status legend">{stageLabels.map((label, i) => <li key={label}><i data-stage={i}/>{label}</li>)}</ul>
    </header>
    <div>{rows.map((row, rowIndex) => {
      const { id, label, counts, to, failed } = row;
      const total = counts && sum(counts);
      return <Link key={id} to={to} className="sx-desk-work-row" style={{ '--desk-row': rowIndex }} aria-label={label + (counts ? ': ' + counts.map((n, i) => format(n) + ' ' + stageLabels[i].toLowerCase()).join(', ') : '')}>
        <span className="sx-desk-work-name"><i><row.icon size={15}/></i>{label}</span>
        <span className="sx-desk-count"><strong><WorkdeskNumber value={total} numberFormat={numberFormat}/></strong><small>{counts ? format(counts[0]) + ' done' : failed ? 'Unavailable' : 'Loading'}</small></span>
        <span className="sx-desk-bars" aria-hidden="true">{total > 0 ? counts.map((n, i) => <span key={i} data-stage={i} data-empty={!n} style={{ flexGrow: n, '--desk-step': rowIndex * 3 + i, marginInlineStart: n && counts.slice(0, i).some(Boolean) ? 3 : 0 }}>{format(n)}</span>) : <span className="sx-desk-bar-empty">{counts ? 'No records' : '—'}</span>}</span>
        <i className="sx-desk-row-arrow"><ArrowUpRight size={14}/></i>
      </Link>;
    })}</div>
    {rows.some(row => row.failed) && <button type="button" className="sx-desk-text-button" onClick={retry}>Retry work totals</button>}
  </section>;
}

function StudioPulse({ tasks, events, timezone, today, date, numberFormat, retry }) {
  const format = value => formatWorkspaceNumber(value, { numberFormat });
  const [scope, setScope] = useState('all');
  const [period, setPeriod] = useState('days');
  const buckets = useMemo(() => workBuckets(tasks, events, period, today, timezone), [tasks, events, period, today, timezone]);
  const needed = scope === 'all' ? [tasks, events] : [scope === 'tasks' ? tasks : events];
  const failed = needed.includes(null), ready = needed.every(Array.isArray);
  const values = buckets.map(row => scope === 'all' ? row.tasks + row.sessions : row[scope]);
  const label = day => date(day, period === 'days' ? { weekday: 'short', day: 'numeric' } : period === 'weeks' ? { day: 'numeric', month: 'short' } : { month: 'short' });
  return <section className="sx-desk-card sx-desk-pulse" aria-labelledby="desk-pulse-heading">
    <header className="sx-desk-card-head"><div><h2 id="desk-pulse-heading">Studio pulse</h2><p>Upcoming sessions and task deadlines</p></div>
      <div className="sx-desk-filters"><select value={scope} aria-label="Workload series" onChange={e => setScope(e.target.value)}>
        <option value="all">All work</option><option value="tasks">Tasks</option><option value="sessions">Sessions</option></select>
        <div role="group" aria-label="Workload period">{[['days', '7 days'], ['weeks', '8 weeks'], ['months', '6 months']].map(([value, text]) =>
          <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{text}</button>)}</div>
      </div>
    </header>
    <p className="sx-desk-volume" aria-live="polite"><strong><WorkdeskNumber value={ready ? sum(values) : null} numberFormat={numberFormat}/></strong> {scope === 'tasks' ? 'task deadlines' : scope === 'sessions' ? 'sessions' : 'scheduled items'}</p>
    {ready ? <WorkloadPlot buckets={buckets} values={values} label={label} format={format} series={scope === 'tasks' ? 'task deadlines' : scope === 'sessions' ? 'sessions' : 'scheduled items'}/> : <div className="sx-desk-no-chart" role="status">{failed ? <><p>Workload couldn’t load.</p><button type="button" onClick={retry}>Try again</button></> : 'Loading workload…'}</div>}
  </section>;
}

function TaskStatus({ counts, format, numberFormat, failed, retry }) {
  const total = counts && sum(counts);
  let drawn = 0;
  return <section className="sx-desk-card sx-desk-status" aria-labelledby="desk-status-heading">
    <header className="sx-desk-card-head"><div><h2 id="desk-status-heading">Task status</h2><p>{counts ? format(total) + ' production tasks' : failed ? 'Task totals unavailable' : 'Loading task totals…'}</p></div>
      <Link to="/admin/post-production">Board</Link></header>
    <div className="sx-desk-status-body"><div className="sx-desk-ring">
      <svg viewBox="0 0 112 112" aria-hidden="true"><circle className="sx-ring-track" cx="56" cy="56" r="46"/>
        {counts?.map((value, i) => {
          const length = total ? value * 100 / total : 0, start = drawn;
          drawn += length;
          return <circle key={i} cx="56" cy="56" r="46" pathLength="100" data-status={i} style={{ '--desk-step': i }}
            strokeDasharray={length + ' ' + (100 - length)} strokeDashoffset={-start}/>;
        })}
      </svg>
      <div><strong><WorkdeskNumber value={total ? Math.round(counts[3] * 100 / total) : null} numberFormat={numberFormat} suffix="%"/></strong><small>done</small></div>
    </div><dl>{taskGroups.map((stage, i) => <div key={stage}><dt><i data-status={i}/>{stage}</dt><dd>{format(counts?.[i])}</dd></div>)}</dl></div>
    {failed && <button type="button" className="sx-desk-text-button" onClick={retry}>Retry task status</button>}
  </section>;
}

export default function CommercialWorkdesk({ overview, overviewError, refreshOverview, preferences, timezone, now, date, refreshKey, cardContent, remove, nextActions, welcome }) {
  const visible = id => preferences.visibleCards.includes(id);
  const pulse = visible('productionPulse');
  const hasTasks = visible('pendingTasks') || pulse;
  const hasEvents = visible('upcomingEvents') || visible('upcomingSchedule') || pulse;
  const { token } = useAuth();
  const [retryKey, setRetryKey] = useState(0);
  const retry = () => setRetryKey(value => value + 1);
  const tasks = useWorkdeskList('/api/tasks', hasTasks, token, refreshKey, retryKey);
  const projects = useWorkdeskList('/api/studio-projects', visible('bookedProjects'), token, refreshKey, retryKey);
  const events = useWorkdeskList('/api/calendar', hasEvents, token, refreshKey, retryKey);
  const today = studioDayKey(now, timezone);
  const counts = useMemo(() => taskBreakdown(tasks), [tasks]);
  const projectCounts = useMemo(() => projectBreakdown(projects), [projects]);
  const format = value => formatWorkspaceNumber(value, preferences);
  const rows = [
    { id: 'pendingTasks', label: 'Tasks', icon: Check, to: '/admin/post-production', counts: counts && [counts[3], counts[1] + counts[2], counts[0]], failed: tasks === null },
    { id: 'bookedProjects', label: 'Projects', icon: Folder, to: '/admin/studio-projects', counts: projectCounts, failed: projects === null },
    { id: 'openEnquiries', label: 'Enquiries', icon: MessageSquare, to: '/admin/crm', counts: enquiryBreakdown(overview?.pipeline), failed: Boolean(overviewError) },
    { id: 'upcomingEvents', label: 'Sessions', icon: CalendarDays, to: '/admin/calendar', counts: sessionBreakdown(events, now.getTime(), today), failed: events === null },
  ].filter(row => visible(row.id));
  const schedule = visible('upcomingSchedule') && <OverviewDaySchedule timezone={timezone} preferences={preferences} refreshKey={refreshKey}
    calendarResult={{ events: events || null, error: events === null }} retryCalendar={retry} remove={remove('upcomingSchedule', 'Upcoming schedule')}/>;
  return <div className="sx-desk-flow">
    <div className="sx-desk-dashboard">
      <WorkSummary rows={rows} format={format} numberFormat={preferences.numberFormat} retry={overviewError ? refreshOverview : retry}/>
      {visible('financePulse') && cardContent.financePulse}
      {pulse && <StudioPulse tasks={tasks} events={events} timezone={timezone} today={today} date={date} numberFormat={preferences.numberFormat} retry={retry}/>}
      {visible('pendingTasks') && <TaskStatus counts={counts} format={format} numberFormat={preferences.numberFormat} failed={tasks === null} retry={retry}/>}
      {nextActions}
      {visible('actionQueue') && cardContent.actionQueue}
      {schedule}
    </div>
    {visible('recentEnquiries') && cardContent.recentEnquiries}
    {preferences.showInspiration && welcome}
    {visible('quickActions') && cardContent.quickActions}
  </div>;
}
