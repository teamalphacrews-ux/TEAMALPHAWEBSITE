import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { operationAPI, operationAuth } from '../operations/operationsUtils';
import { eventOnStudioDay, shiftDayKey, studioDayKey, studioDateTimeInput, studioDayBounds } from '../../../utils/studioTime';
import { formatWorkspaceDate, formatWorkspaceTime } from '../../../utils/workspaceLocale';
import { recordDestination } from '../../../utils/studioNavigation';
import './overviewDaySchedule.css';

const minuteOnDay = (value, day, timezone, end = false) => {
  const key = studioDayKey(value, timezone);
  if (key < day) return 0;
  if (key > day) return 1440;
  const clock = studioDateTimeInput(value, timezone).slice(11).split(':').map(Number);
  return Number.isFinite(clock[0]) ? clock[0] * 60 + clock[1] : end ? 1440 : 0;
};

export default function OverviewDaySchedule({ timezone = 'Asia/Kolkata', preferences = {}, refreshKey = 0, remove }) {
  const { token } = useAuth();
  const headingId = useId();
  const [result, setResult] = useState({ events: null, error: false });
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const today = studioDayKey(now, timezone);
  const day = selectedDay || today;
  const bounds = studioDayBounds(day, timezone);
  const clockChanges = Date.parse(bounds.end) - Date.parse(bounds.start) !== 86400000;
  const displayPreferences = { ...preferences, timezone: 'studio' };
  const date = (value, options) => formatWorkspaceDate(value, displayPreferences, timezone, options);
  const time = value => formatWorkspaceTime(value, displayPreferences, timezone) + (clockChanges ? ' ' + new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date(value)).find(part => part.type === 'timeZoneName')?.value : '');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await axios.get(operationAPI + '/api/calendar', { ...operationAuth(), signal: controller.signal });
        if (!Array.isArray(response.data)) throw new Error('Unexpected calendar response');
        setResult({ events: response.data, error: false });
      } catch (error) {
        if (!axios.isCancel(error)) setResult(current => ({ ...current, error: true }));
      }
    };
    load();
    const timer = window.setInterval(() => {
      setNow(new Date());
      if (!document.hidden) load();
    }, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refreshKey, retry, token]);

  const events = (result.events || [])
    .filter(event => eventOnStudioDay(event, day, timezone))
    .sort((a, b) => Number(b.allDay === true) - Number(a.allDay === true) || Date.parse(a.start) - Date.parse(b.start));
  const shown = events.slice(0, 4);
  const timed = shown.filter(event => event.allDay !== true);
  const rangeStart = Math.min(8 * 60, ...timed.map(event => Math.floor(minuteOnDay(event.start, day, timezone) / 120) * 120));
  const rangeEnd = Math.max(20 * 60, ...timed.map(event => Math.ceil(minuteOnDay(event.end, day, timezone, true) / 120) * 120));
  const range = Math.max(120, rangeEnd - rangeStart);
  const ticks = Array.from({ length: 5 }, (_, index) => rangeStart + range * index / 4);
  // Axis positions are wall-clock times; a neutral date avoids nonexistent DST times.
  const tickLabel = minutes => formatWorkspaceTime(new Date(Date.UTC(2000, 0, 1, 0, minutes)), { ...preferences, timezone: 'UTC' }, 'UTC').replace(':00', '');
  const label = date(day, { weekday: 'short', month: 'short', day: 'numeric' });
  const eventTime = event => {
    if (event.allDay === true) return 'All day';
    const startsBefore = studioDayKey(event.start, timezone) < day;
    const endsAfter = studioDayKey(event.end, timezone) > day;
    return `${startsBefore ? 'Continues' : time(event.start)} – ${endsAfter ? 'Next day' : time(event.end)}`;
  };

  return <section className="overview-day-schedule" aria-labelledby={headingId} data-overview-card="upcomingSchedule">
    {remove}
    <div className="overview-day-top">
      <h2 id={headingId}>{label}</h2>
      <div className="overview-day-navigation" aria-label="Choose schedule day">
        <button type="button" className="overview-day-today" onClick={() => setSelectedDay(null)} disabled={day === today}>Today</button>
        <button type="button" onClick={() => setSelectedDay(shiftDayKey(day, -1))} aria-label="Previous schedule day"><ChevronLeft size={14} /></button>
        <button type="button" onClick={() => setSelectedDay(shiftDayKey(day, 1))} aria-label="Next schedule day"><ChevronRight size={14} /></button>
      </div>
    </div>
    <p className="overview-day-zone">Your day, in focus <span>· {timezone}</span></p>
    <div className="overview-day-scene">
      <div className="overview-day-landscape" aria-hidden="true"><i /><i /><i /></div>
      {result.error ? <div className="overview-day-empty" role="alert"><CalendarDays size={23} /><strong>Calendar unavailable</strong><span>Your schedule couldn’t be loaded.</span><button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={13} /> Try again</button></div>
        : result.events === null ? <div className="overview-day-empty" role="status"><CalendarDays size={23} /><span>Loading your schedule…</span></div>
          : !events.length ? <div className="overview-day-empty"><CalendarDays size={23} /><strong>A little breathing room.</strong><span>No events scheduled for {day === today ? 'today' : 'this day'}.</span></div>
            : <>
              {!clockChanges && <div className="overview-day-axis" aria-hidden="true">{ticks.map((tick, index) => <span key={tick} style={{ left: `${index * 25}%` }}>{tickLabel(tick)}</span>)}</div>}
              <div className="overview-day-timeline" aria-label={`Schedule for ${label}`}>
                {shown.map((event, index) => {
                  const start = event.allDay === true || clockChanges ? rangeStart : minuteOnDay(event.start, day, timezone);
                  const end = event.allDay === true || clockChanges ? rangeEnd : minuteOnDay(event.end, day, timezone, true);
                  const left = Math.max(0, Math.min(100, (start - rangeStart) / range * 100));
                  const width = Math.max(1, Math.min(100 - left, (end - start) / range * 100));
                  return <div className="overview-day-lane" key={event._id || `${event.start}-${index}`}>
                    <Link to={recordDestination('event', String(event._id || ''))} className={`overview-day-event tone-${index % 3}${event.allDay === true ? ' is-all-day' : ''}`} style={{ '--event-start': `${left}%`, '--event-width': `${width}%` }} aria-label={`${event.title || 'Untitled event'}, ${eventTime(event)}`} title={`${event.title || 'Untitled event'} · ${eventTime(event)}${event.location ? ` · ${event.location}` : ''}`}>
                      <strong>{event.title || 'Untitled event'}</strong><span>{eventTime(event)}</span>
                    </Link>
                  </div>;
                })}
              </div>
            </>}
    </div>
    <div className="overview-day-footer">
      <span>{result.events !== null && !result.error ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : 'Studio calendar'}</span>
      <Link to={events.length > shown.length ? recordDestination('event', String(events[shown.length]._id || '')) : '/admin/calendar'}>{events.length > shown.length ? `+${events.length - shown.length} more · Open calendar` : 'View calendar'}<ArrowUpRight size={13} /></Link>
    </div>
  </section>;
}
