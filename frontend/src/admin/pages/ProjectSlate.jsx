import { useLayoutEffect, useRef } from 'react';
import { recordPositions, settleRecordPositions } from './recordTransitions';
import useReducedStudioMotion from '../components/operations/useReducedStudioMotion';
import { ArrowUpRight, CalendarDays, MapPin, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStudioPreferences } from '../components/common/StudioPreferences';
import { useStudioIdentity } from '../../utils/studioIdentity';
import { studioDayKey, validStudioDay } from '../../utils/studioTime';
import { resolveWorkspaceTimezone } from '../../utils/workspaceLocale';

const month = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });
const monthAndYear = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Project form dates are calendar days. The API also serializes them as UTC-midnight timestamps.
function projectDay(value) {
  if (!value) return null;
  const key = String(value).slice(0, 10);
  return validStudioDay(key) ? new Date(key + 'T00:00:00Z') : null;
}

function recordDate(value) {
  const day = projectDay(value);
  return day ? fullDate.format(day) : 'Not scheduled';
}

function DateMark({ project }) {
  const date = projectDay(project.startDate);
  return <span className="record-date-mark" aria-hidden="true">
    {date ? <><strong>{date.getUTCDate()}</strong><small>{month.format(date)}</small></> : <CalendarDays size={22} />}
  </span>;
}

function ProjectPercent({ value }) {
  const label = useRef(null);
  const previous = useRef(0);
  const reduced = useReducedStudioMotion();
  useLayoutEffect(() => {
    const node = label.current;
    const from = previous.current;
    if (reduced || from === value) {
      node.textContent = value + '%';
      previous.current = value;
      return;
    }
    node.textContent = from + '%';
    let frame;
    const start = performance.now() + 200;
    const next = time => {
      const progress = Math.min(1, Math.max(0, (time - start) / 1100));
      const amount = progress === 1 ? value : Math.round(from + (value - from) * (1 - Math.pow(2, -10 * progress)));
      if (previous.current !== amount) node.textContent = amount + '%';
      previous.current = amount;
      if (progress < 1) frame = requestAnimationFrame(next);
    };
    frame = requestAnimationFrame(next);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <strong ref={label} aria-hidden="true">{value}%</strong>;
}

export function ProjectSlate({ projects, progress, pinned, togglePin, canReadClients }) {
  const slate = useRef(null);
  const previous = useRef(null);
  useLayoutEffect(() => {
    if (!previous.current) return;
    const { positions, focus } = previous.current;
    previous.current = null;
    settleRecordPositions(slate.current, positions);
    if (focus?.isConnected && document.activeElement === document.body) focus.focus({ preventScroll: true });
  }, [pinned]);
  const pin = (event, id) => {
    previous.current = { positions: recordPositions(slate.current), focus: event.currentTarget === document.activeElement ? event.currentTarget : null };
    togglePin(id);
  };
  const cards = [...projects].sort((a, b) => Number(pinned.includes(b._id)) - Number(pinned.includes(a._id)));
  return <div ref={slate} className="sx-project-grid record-slate" aria-label="Project cards">{cards.map((project, index) => {
    const client = project.contactId;
    const name = [client?.firstName, client?.lastName].filter(Boolean).join(' ');
    const title = project.name || 'Untitled project';
    const status = project.status || 'Inquiry';
    const destination = '/admin/studio-projects/' + project._id;
    const isPinned = pinned.includes(project._id);
    const tasks = progress.get(project._id);
    const percent = tasks && Math.round(100 * tasks.done / tasks.total);
    return <article className="record-project-tile" key={project._id} data-record-key={project._id} style={{ '--record-order': Math.min(index, 10) }}>
      <header><span className="record-category">{project.type || 'Project'}</span>
        <button className="record-pin" type="button" aria-label={(isPinned ? 'Unpin ' : 'Pin ') + title} aria-pressed={isPinned} onClick={event => pin(event, project._id)}><Pin size={15} /></button>
      </header>
      <div className="record-project-identity">{tasks
        ? <div className="record-progress-mark" aria-label={percent + '% of tasks completed'}><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="record-ring-track" cx="32" cy="32" r="28" /><circle className="record-ring-fill" cx="32" cy="32" r="28" pathLength="100" style={{ '--remaining': 100 - percent }} /></svg><ProjectPercent value={percent} /></div>
        : <DateMark project={project} />}<div>
        <h2><Link to={destination}>{title}</Link></h2>
        {name && <p>{canReadClients && client._id ? <Link to={'/admin/contacts/' + client._id}>{name}</Link> : name}</p>}
      </div></div>
      <div className="record-project-meta"><span className={'reference-status ' + status.toLowerCase()}>{status}</span>{tasks && <span>{tasks.done} / {tasks.total} tasks</span>}<span>{recordDate(project.startDate)}</span></div>
      <footer><span><MapPin size={15} />{project.location || 'Location to be confirmed'}</span><Link className="record-open" to={destination} aria-label={'Open project ' + title}><ArrowUpRight size={17} /></Link></footer>
    </article>;
  })}</div>;
}

const dayLength = 86400000;
const tickDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayIndex = date => date.getTime() / dayLength;

function ScheduleChart({ ordered, progress }) {
  const { preferences } = useStudioPreferences();
  const { identity } = useStudioIdentity();
  const timezone = identity?.timezone || resolveWorkspaceTimezone(preferences);
  const scheduled = ordered.filter(item => item.date).map(({ project, date }) => {
    const start = dayIndex(date);
    const end = projectDay(project.endDate);
    return { project, start, end: end ? Math.max(start, dayIndex(end)) : start };
  });
  if (!scheduled.length) return null;
  const begin = scheduled[0].start;
  const finish = scheduled.reduce((latest, row) => Math.max(latest, row.end), begin);
  const tickSize = Math.max(1, Math.ceil((finish - begin + 1) / 77) * 7);
  const ticks = Math.max(2, Math.ceil((finish - begin + 1) / tickSize));
  const span = ticks * tickSize;
  const today = Date.parse(studioDayKey(new Date(), timezone) + 'T00:00:00Z') / dayLength;
  return <section className="record-gantt"><h2>Project schedule</h2><p>Shoot dates and production task progress</p>
    <div className="record-gantt-scroll" role="region" tabIndex={0} aria-label="Project schedule chart">
      <div className="record-gantt-grid" style={{ '--ticks': ticks }}>
        <div className="record-gantt-heading"><span>Project</span><div>{Array.from({length: ticks}, (_, i) => <small key={i}>{tickDate.format(new Date((begin + i * tickSize) * dayLength))}</small>)}</div></div>
        {scheduled.map(({project, start, end}, index) => {
          const tasks = progress.get(project._id);
          const complete = tasks ? Math.round(100 * tasks.done / tasks.total) : 0;
          const dates = recordDate(project.startDate) + (project.endDate && end !== start ? ' – ' + recordDate(project.endDate) : '');
          return <div className="record-gantt-row" key={project._id} style={{ '--record-order': Math.min(index, 10) }}>
            <div className="record-gantt-project"><Link to={'/admin/studio-projects/' + project._id}>{project.name || 'Untitled project'}</Link><small>{dates}</small></div>
            <div className="record-gantt-track">
              {today >= begin && today < begin + span && <i className="record-gantt-today" style={{ left: (100 * (today - begin) / span) + '%' }} title="Today" />}
              <span className="record-gantt-bar" style={{ left: (100 * (start - begin) / span) + '%', width: (100 * (end - start + 1) / span) + '%', '--done': complete + '%' }}
                title={dates + (tasks ? ' · ' + complete + '% of tasks completed' : '')}>{tasks && <i aria-hidden="true" />}</span>
              {tasks && <span className="record-gantt-percent">{complete}%</span>}
            </div>
          </div>;
        })}
      </div>
    </div></section>;
}

export function ProjectTimeline({ projects, progress }) {
  const ordered = projects.map(project => ({ project, date: projectDay(project.startDate) }))
    .sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
  const groups = new Map();
  ordered.forEach(({ project, date }) => {
    const label = date ? monthAndYear.format(date) : 'Unscheduled';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(project);
  });
  return <div className="record-project-timeline" aria-label="Project timeline"><ScheduleChart ordered={ordered} progress={progress} />{[...groups].map(([label, entries]) =>
    <section key={label} className={label === 'Unscheduled' ? 'record-undated' : 'record-mobile-agenda'}><h2>{label}</h2><ul>{entries.map(project =>
      <li key={project._id}><DateMark project={project} /><div>
        <Link to={'/admin/studio-projects/' + project._id}>{project.name || 'Untitled project'}</Link>
        <small>{recordDate(project.startDate)}{project.endDate && recordDate(project.endDate) !== recordDate(project.startDate) ? ' – ' + recordDate(project.endDate) : ''}{project.location && ' · ' + project.location}</small>
      </div><span className={'reference-status ' + (project.status || 'Inquiry').toLowerCase()}>{project.status || 'Inquiry'}</span></li>)}</ul></section>)}</div>;
}
