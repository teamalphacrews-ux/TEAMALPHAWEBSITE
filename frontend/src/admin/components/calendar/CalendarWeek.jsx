import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { eventOnStudioDay, hasAllDayRange, studioDateTimeInput } from '../../../utils/studioTime';
import { calendarWeekDays } from './calendarData';

function minuteOfDay(value, day, timezone) {
  const wallTime = studioDateTimeInput(value, timezone);
  const localDay = wallTime.slice(0, 10);
  if (localDay < day) return 0;
  if (localDay > day) return 1440;
  return Number(wallTime.slice(11, 13)) * 60 + Number(wallTime.slice(14, 16));
}

function daySchedule(events, day, timezone) {
  const allDay = [], timed = [];
  for (const event of events) {
    if (!eventOnStudioDay(event, day, timezone)) continue;
    if (hasAllDayRange(event) || event.allDay) allDay.push(event);
    else {
      const start = minuteOfDay(event.start, day, timezone);
      const end = Math.max(start + 1, minuteOfDay(event.end, day, timezone));
      timed.push({ event, start, end, lane: 0, columns: 1 });
    }
  }
  timed.sort((a, b) => a.start - b.start || b.end - a.end);
  let group = [], laneEnds = [];
  const finishGroup = () => {
    for (const item of group) item.columns = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of timed) {
    if (group.length && laneEnds.every(end => end <= item.start)) finishGroup();
    const free = laneEnds.findIndex(end => end <= item.start);
    item.lane = free === -1 ? laneEnds.length : free;
    laneEnds[item.lane] = item.end;
    group.push(item);
  }
  finishGroup();
  return { day, timed, allDay };
}

const dateValue = (day, options) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(new Date(day + 'T12:00:00Z'));
const hoursRowHeight = 48;
const minBookingHeight = 44;
const needsAgendaRow = ({ start, end, columns }) => (end - start) / 60 * hoursRowHeight < minBookingHeight || columns > 2;

export default function CalendarWeek({ selected, today, events, timezone, time, onSelectDay, openEvent }) {
  const week = useMemo(() => calendarWeekDays(selected).map(day => daySchedule(events, day, timezone)), [selected, events, timezone]);
  const timedEvents = week.flatMap(day => day.timed);
  const start = timedEvents.reduce((min, item) => Math.min(min, Math.floor(item.start / 60)), 8);
  const end = timedEvents.reduce((max, item) => Math.max(max, Math.min(24, Math.ceil(item.end / 60))), 18);
  const duration = (end - start) * 60;
  const hasAllDay = week.some(day => day.allDay.length);
  const dayHeaders = ({ compact = false } = {}) => week.map(({ day, allDay, timed }) => {
    const count = allDay.length + timed.length;
    const label = count === 1 ? '1 event' : `${count} events`;
    return <button type="button" key={day} className={'sx-week-date' + (day === today ? ' is-today' : '')}
      aria-current={day === today ? 'date' : undefined}
      aria-label={`View agenda for ${dateValue(day, { dateStyle: 'full' })}, ${label}`} onClick={() => onSelectDay(day)}>
      <span>{dateValue(day, { weekday: 'short' })}</span><strong>{Number(day.slice(-2))}</strong>
      {count > 0 && <span className="sx-week-date-count" aria-hidden="true">{compact ? count : label}</span>}
    </button>;
  });
  const agendaLabel = (event, day) => studioDateTimeInput(event.start, timezone).slice(0, 10) < day ? 'Continues today' : time(event.start);
  const agendaRows = (day, rows) => <section key={day} className="sx-week-agenda-day">
    <h3>{dateValue(day, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
    {rows.map(({ event, label }) => <button className="sx-week-agenda-event" type="button" key={event._id} onClick={() => openEvent(event)}>
      <span><strong>{event.title}</strong><small>{[label, event.location].filter(Boolean).join(' · ')}</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>)}
  </section>;
  return <div className="sx-week-schedule" style={{ '--week-hour-height': `${hoursRowHeight}px` }}>
    <div className="sx-week-compact">
      <div className="sx-week-compact-dates" role="group" aria-label={'Week schedule in ' + timezone}>{dayHeaders({ compact: true })}</div>
      {week.filter(({ allDay, timed }) => allDay.length || timed.length).map(({ day, allDay, timed }) =>
        agendaRows(day, [...allDay.map(event => ({ event, label: 'All day' })), ...timed.map(({ event }) => ({ event, label: agendaLabel(event, day) }))])
      )}
      {!hasAllDay && !timedEvents.length && <p className="workspace-day-empty">No events are scheduled this week.</p>}
    </div>
    <div className="sx-week-scroll" tabIndex={0} role="region" aria-label={'Week schedule in ' + timezone}>
      <div className="sx-week">
        <div className="sx-week-head"><span aria-hidden="true" />{dayHeaders()}</div>
        {hasAllDay && <div className="sx-week-all"><small>All day</small>{week.map(({ day, allDay }) => <div key={day}>{allDay.map(event => <button type="button" key={event._id} onClick={() => openEvent(event)}>{event.title}</button>)}</div>)}</div>}
        <div className="sx-week-body">
          <div className="sx-week-clock">{Array.from({ length: end - start }, (_, index) => <time key={index}>{String(start + index).padStart(2, '0')}:00</time>)}</div>
          {week.map(({ day, timed }) => <div className={'sx-week-day' + (day === today ? ' is-today' : '')} key={day} role="group" aria-label={dateValue(day, { dateStyle: 'full' })}>
            {timed.map(item => {
              const { event, start: from, end: to, lane, columns } = item;
              const style = { top: (from - start * 60) / duration * 100 + '%', height: (to - from) / duration * 100 + '%', left: lane / columns * 100 + '%', width: `calc(${100 / columns}% - 4px)` };
              if (needsAgendaRow(item)) return <span key={event._id} className="sx-week-booking sx-week-marker" data-event-type={event.type} aria-hidden="true" style={style} />;
              const details = [agendaLabel(event, day), event.location].filter(Boolean).join(' · ');
              return <button type="button" key={event._id} className="sx-week-booking" data-event-type={event.type} style={style}
                title={event.title + ' · ' + details} onClick={() => openEvent(event)}>
                <strong>{event.title}</strong><small>{details}</small>
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    {timedEvents.some(needsAgendaRow) && <section className="sx-week-dense" aria-label="Short or overlapping events">
      <p>Short or overlapping events</p>
      <div>{week.map(({ day, timed }) => {
        const dense = timed.filter(needsAgendaRow);
        return dense.length ? agendaRows(day, dense.map(({ event }) => ({ event, label: agendaLabel(event, day) }))) : null;
      })}</div>
    </section>}
  </div>;
}
