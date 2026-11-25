import { hasModuleAccess, hasFullModuleAccess } from '../../utils/moduleAccess';
import { canWriteWorkspaceModule } from '../../utils/workspaceActions';
import StudioSelect from '../components/common/StudioSelect';
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CalendarDays,
  MapPin,
  UsersRound,
  Trash2,
  Pencil,
} from "lucide-react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import EventForm from "../components/calendar/EventForm";
import CalendarWeek from '../components/calendar/CalendarWeek';
import SectionSelectionIndicator from './SectionSelectionIndicator';
import { useSectionArrival } from './useSectionArrival';
import CalendarInsights from "../components/calendar/CalendarInsights";
import { calendarCreationRequest, calendarMonthGrid, calendarMonthLoad, calendarWeekDays, indexCalendarDays, shiftCalendarMonth } from "../components/calendar/calendarData";
import { safeStudioReturn } from '../../utils/studioNavigation';
import { deriveCrewSchedule } from "../components/operations/crewSchedule";
import { operationAPI } from "../components/operations/operationsUtils";
import { useAuth } from "../../context/AuthContext";
import { IS_COMMERCIAL_DEPLOYMENT } from '../../saas/release';
import ScheduledWorkAction from '../components/operations/ScheduledWorkAction';
import { nextCalendarSession } from '../components/operations/nextScheduledWork';
import { useStudioIdentity } from "../../utils/studioIdentity";
import { eventOnStudioDay, eventStartDay, shiftDayKey, studioDayKey, studioDateTimeToISO } from "../../utils/studioTime";
import { eventScheduleLabel } from "../../utils/eventSchedule";
import { useStudioPreferences } from '../components/common/StudioPreferences';
import { formatWorkspaceDate, formatWorkspaceTime, resolveWorkspaceTimezone } from '../../utils/workspaceLocale';
import '../components/calendar/calendarRefinements.css';
import './calendarWorkspace.css';
import './schedulingRefinement.css';
import './studioCalendarDesk.css';
import { GOOGLE_PREVIEW_MESSAGE, googleCalendarHandoff, googleConnectionError } from "../components/calendar/googleConnection";
import {
  WorkspaceHeader,
  WorkspaceError,
  WorkspaceSearch,
  WorkspaceEmpty,
  WorkspaceDialog,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
} from "../components/operations/workspaceData";
const emptyCalendarRecords = [];

function useCalendarSchedule(events, { query, crewFilter, month, selected, timezone, dateLabel, agendaScope }) {
  const visible = useMemo(() => events.filter(
    (event) =>
      (crewFilter === "all" ||
        (event.teamMembers || []).includes(crewFilter)) &&
      [event.title, event.location, event.type]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  ), [events, crewFilter, query]);
  const days = useMemo(() => calendarMonthGrid(month), [month]);
  const dayLabels = useMemo(() => new Map(days.map(day => [day, dateLabel(day)])), [days, dateLabel]);
  const eventsByDay = useMemo(() => indexCalendarDays(visible, days, timezone), [visible, days, timezone]);
  const monthLoad = useMemo(() => calendarMonthLoad(visible, month, timezone, eventsByDay), [visible, month, timezone, eventsByDay]);
  const monthEvents = monthLoad.events;
  const selectedEvents = useMemo(() => {
    const items = eventsByDay.get(selected) ?? visible.filter(event => eventOnStudioDay(event, selected, timezone));
    return [...items].sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [eventsByDay, visible, selected, timezone]);
  const agendaEvents = useMemo(() => agendaScope === 'day' ? selectedEvents : [...monthEvents].sort((a, b) => new Date(a.start) - new Date(b.start)), [agendaScope, selectedEvents, monthEvents]);
  return { visible, days, eventsByDay, dayLabels, selectedEvents, monthLoad, agendaEvents };
}

function CalendarEventEditor({ timezone, ...props }) {
  // One editing session uses one resolved zone. Later settings refreshes must
  // not remount the form or reinterpret a time the user has already entered.
  const [editorTimezone] = useState(timezone);
  return <EventForm key={editorTimezone} timezone={editorTimezone} {...props} />;
}
export default function Calendar() {
  const { user } = useAuth();
  const canSchedule = !IS_COMMERCIAL_DEPLOYMENT || canWriteWorkspaceModule(user, 'calendar');
  const canRemove = canSchedule && (!IS_COMMERCIAL_DEPLOYMENT || (user?.workspaceRole || user?.workspace?.role) !== 'staff');
  const { identity, loading: identityLoading } = useStudioIdentity();
  const { preferences } = useStudioPreferences();
  const timezone = resolveWorkspaceTimezone(preferences, identity?.timezone);
  const time = value => formatWorkspaceTime(value, preferences, identity?.timezone);
  const dateLabel = useCallback((key, options) => formatWorkspaceDate(key, preferences, identity?.timezone, options), [preferences, identity?.timezone]);
  const eventTime = event => eventScheduleLabel(event, timezone, { date: dateLabel, time });
  const isPreview = user?.isPreview === true;
  const [sessionParams, setSessionParams]=useSearchParams();
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/calendar",
    hasModuleAccess(user, 'crew') ? '/api/photographers' : null,
    hasModuleAccess(user, 'enquiries') ? '/api/leads' : null,
  ]);
  const [disconnecting, setDisconnecting] = useState(false);
  const [events = emptyCalendarRecords, crew = emptyCalendarRecords, leads = emptyCalendarRecords] = data;
  const eventId = sessionParams.get('event');
  const linkedEvent = events.find(event => String(event._id) === eventId);
  const linkedDay = linkedEvent ? eventStartDay(linkedEvent, timezone) : '';
  const connection = useWorkspaceData([isPreview ? null : "/api/calendar/sync-status"]);
  const sync = connection.data[0] || {};
  const [monthState, setMonth] = useState(null),
    [selectedState, setSelected] = useState(null),
    [view, setView] = useState(() =>
      window.innerWidth < 680 ? "agenda" : IS_COMMERCIAL_DEPLOYMENT ? "week" : "month",
    ),
    [agendaScope, setAgendaScope] = useState("month"),
    [query, setQuery] = useState(""),
    [crewFilter, setCrewFilter] = useState("all"),
    [editingState, setEditing] = useState(()=>IS_COMMERCIAL_DEPLOYMENT ? undefined : sessionParams.get("new")==="1"?{}:sessionParams.get("contact")?{
      title:"Client session",type:"Meeting",contactId:sessionParams.get("contact"),studioProjectId:sessionParams.get("project")||null,
    }:undefined),
    [detailState, setDetail] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [syncBusy, setSyncBusy] = useState(false),
    [connectionError, setConnectionError] = useState("");
  const callbackResult = sessionParams.get("sync");
  const todayKey = studioDayKey(new Date(), timezone);
  const month = linkedDay ? linkedDay.slice(0, 7) : monthState || todayKey.slice(0, 7);
  const selected = linkedDay || selectedState || todayKey;
  const creationRequest = IS_COMMERCIAL_DEPLOYMENT && !identityLoading
    ? calendarCreationRequest(sessionParams, { day: selected, timezone, leads: data[2], loading: loading && !error })
    : null;
  const editDraft = creationRequest?.event ?? editingState;
  const editing = editDraft && !editDraft.start ? { ...editDraft, start: studioDateTimeToISO(`${selected}T10:00`, timezone), end: studioDateTimeToISO(`${selected}T11:00`, timezone) } : editDraft;
  const detail = linkedEvent || detailState;
  const setupMessage = isPreview ? GOOGLE_PREVIEW_MESSAGE : sync.setupMessage || "";
  const googleStatus = isPreview ? 'Sample preview' : connection.loading ? 'Checking connection…' : connection.error ? 'Connection unavailable' : sync.configured === false ? 'Setup required' : sync.isSynced ? sync.syncError ? 'Sync needs attention' : 'Connected' : 'Not connected';
  useEffect(() => {
    if (isPreview || !hasFullModuleAccess(user)) return;
    let socket, cancelled = false;
    const connect = () => { if (cancelled) return; socket = io(operationAPI + (user?.workspace?.id ? '/studio-' + user.workspace.id : ''), { auth: { token: localStorage.getItem('token') } }); socket.on('calendar_update', () => { reload(); connection.reload(); }); };
    // The access check initializes the namespace before an authenticated studio connects.
    if (user?.workspace?.id) workspaceRequest('get', '/api/saas/workspace').then(connect).catch(() => {});
    else connect();
    return () => { cancelled = true; socket?.disconnect(); };
  }, [reload, connection.reload, isPreview, user, user?.workspace?.id]);
  const { visible, days, eventsByDay, dayLabels, selectedEvents, monthLoad, agendaEvents } = useCalendarSchedule(
    events, { query, crewFilter, month, selected, timezone, dateLabel, agendaScope },
  );
  const monthEvents = monthLoad.events;
  const returnTo = safeStudioReturn(sessionParams.get('returnTo'), '');
  const closeDetail = () => {
    setDetail(null);
    if (linkedDay) { setMonth(linkedDay.slice(0, 7)); setSelected(linkedDay); }
    if (eventId) setSessionParams(current => { const next = new URLSearchParams(current); next.delete('event'); return next; }, { replace: true });
  };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const schedule = useMemo(() => deriveCrewSchedule(crew, events, now), [crew, events, now]);
  const nextEvent = IS_COMMERCIAL_DEPLOYMENT && !loading && !error
    ? nextCalendarSession(view === 'agenda' && agendaScope === 'day' ? selectedEvents : month === todayKey.slice(0, 7) ? visible : monthEvents, now, timezone)
    : null;
  const weekDays = calendarWeekDays(selected);
  const calendarPanel = useRef(null);
  const dayAgendaFocus = useRef(false);
  const dayHeading = useRef(null);
  const openDayAgenda = day => {
    dayAgendaFocus.current = true;
    setMonth(day.slice(0, 7));
    setSelected(day);
    setView('agenda');
    setAgendaScope('day');
  };
  useEffect(() => {
    if (!dayAgendaFocus.current || view !== 'agenda' || agendaScope !== 'day') return;
    dayAgendaFocus.current = false;
    dayHeading.current?.focus({ preventScroll: true });
  }, [view, agendaScope, selected]);
  const period = view === 'week' ? weekDays[0] : view === 'agenda' && agendaScope === 'day' ? selected : month;
  const selection = ['week', 'month', 'agenda'].indexOf(view) + '/' + period;
  useSectionArrival(calendarPanel, selection, '.sx-calendar-motion-surface');
  const rangeLabel = view === 'week'
    ? dateLabel(weekDays[0], { month: 'short', day: 'numeric', year: undefined }) + ' – ' + dateLabel(weekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })
    : dateLabel(month + '-01', { month: 'long', year: 'numeric', day: undefined });
  const changeMonth = (offset) => {
    if (view === 'week') {
      const nextDay = shiftDayKey(selected, offset * 7);
      setMonth(nextDay.slice(0, 7));
      setSelected(nextDay);
      return;
    }
    const next = shiftCalendarMonth(month, offset);
    setMonth(next);
    setSelected(`${next}-01`);
  };
  const openNew = () => {
    const start = studioDateTimeToISO(`${selected}T10:00`, timezone);
    const end = studioDateTimeToISO(`${selected}T18:00`, timezone);
    setEditing({ start, end });
    setSaveError("");
  };
  const closeEditor = () => {
    setEditing(undefined);
    setSaveError('');
    if (creationRequest) setSessionParams(current => {
      const next = new URLSearchParams(current);
      ['new', 'contact', 'project'].forEach(key => next.delete(key));
      return next;
    }, { replace: true });
  };
  const newRequest=useRef('');
  useEffect(()=>{if(IS_COMMERCIAL_DEPLOYMENT||sessionParams.get('new')!=='1'||newRequest.current===sessionParams.toString())return;
    const signature=sessionParams.toString();let active=true;Promise.resolve().then(()=>{if(active){newRequest.current=signature;openNew();}});return()=>{active=false;};
    // Existing openNew uses the configured studio timezone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionParams,timezone]);

  const save = async (values) => {
    if (busy || !canSchedule) return;
    setBusy(true);
    setSaveError("");
    try {
      const result = await workspaceRequest(
        editing?._id ? "patch" : "post",
        "/api/calendar" + (editing?._id ? "/" + editing._id : ""),
        values,
      );
      closeEditor();
      reload();
      if (result.syncWarning) toast(result.syncWarning);
      else toast.success("Studio event saved");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (event) => {
    event.preventDefault();
    if (busy || !canRemove) return;
    setBusy(true);
    try {
      const result = await workspaceRequest("delete", "/api/calendar/" + deleting._id);
      setDeleting(null);
      setDetail(null);
      reload();
      if (result.warning) toast(result.warning);
      else toast.success("Event removed");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const syncNow = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setConnectionError("");
    try {
      const result = await workspaceRequest("get", "/api/calendar/sync-now");
      if (result?.success !== true) throw new Error("Google Calendar did not finish synchronizing. Please try again.");
      reload();
      connection.reload();
      toast.success("Calendar synchronization completed");
    } catch (err) {
      setConnectionError(googleConnectionError(err));
      connection.reload();
    } finally {
      setSyncBusy(false);
    }
  };
  const connect = async () => {
    if (isPreview || syncBusy) return;
    setSyncBusy(true);
    setConnectionError("");
    try {
      const result = IS_COMMERCIAL_DEPLOYMENT
        ? await workspaceRequest("post", "/api/calendar/connect")
        : await workspaceRequest("get", "/api/auth/google");
      window.location.assign(googleCalendarHandoff(result, operationAPI, window.location.origin));
    } catch (err) {
      setConnectionError(googleConnectionError(err));
    } finally {
      setSyncBusy(false);
    }
  };
  const disconnect = async () => {
    setSyncBusy(true);
    setConnectionError("");
    try {
      await workspaceRequest("post", "/api/calendar/disconnect-google");
      connection.reload();
      reload();
      toast.success("Google Calendar disconnected");
    } catch (error) {
      setConnectionError(googleConnectionError(error));
    } finally {
      setSyncBusy(false);
      setDisconnecting(false);
    }
  };
  const ownerAccess = !IS_COMMERCIAL_DEPLOYMENT || (canSchedule && (user?.workspaceRole || user?.workspace?.role) === 'owner' && sync.canManage !== false);
  const needsReconnect = sync.reconnectRequired || /reconnect/i.test(sync.syncError || '');
  const googleConnection = <>
      <section className="scheduling-connection" aria-label="Google Calendar connection">
        <div className="scheduling-connection-copy">
          <CalendarDays size={19} aria-hidden="true" />
          <div><strong>Google Calendar <span className={'scheduling-status' + (sync.isSynced && !sync.syncError && !isPreview ? ' is-connected' : '')}>{googleStatus}</span></strong><p id="google-calendar-setup">{setupMessage || (sync.isSynced ? `${sync.email || 'Your Google account'} · Studio times use ${timezone}.` : !ownerAccess ? 'The studio owner manages this calendar connection.' : IS_COMMERCIAL_DEPLOYMENT ? 'Choose a Google account dedicated to this studio. Its primary calendar events will be visible to your team. New studio events sync back to Google.' : 'Connect your Google account to keep studio events in sync.' )}</p></div>
        </div>
        <div className="scheduling-connection-actions">
        <button
          className="studio-button"
          onClick={sync.isSynced && !needsReconnect ? syncNow : connect}
          disabled={!ownerAccess || isPreview || syncBusy || connection.loading || sync.configured === false}
          aria-describedby={setupMessage ? "google-calendar-setup" : undefined}
        >
          <RefreshCw size={14} />
          {syncBusy
            ? sync.isSynced ? "Syncing…" : "Connecting…"
            : sync.isSynced
              ? needsReconnect ? "Reconnect Google" : "Sync Google"
              : "Connect Google"}
        </button>
        {IS_COMMERCIAL_DEPLOYMENT && ownerAccess && sync.isSynced && <button type="button" className="studio-button ghost" disabled={isPreview || syncBusy} onClick={() => setDisconnecting(true)}>Disconnect</button>}
        </div>
      </section>
      {disconnecting && <WorkspaceDialog title="Disconnect Google Calendar?" submitLabel="Disconnect" busy={syncBusy}
        onClose={() => setDisconnecting(false)} onSubmit={event => { event.preventDefault(); disconnect(); }}>
        <p>Events already in your studio stay here. Future changes will stop syncing with Google.</p>
      </WorkspaceDialog>}
      <WorkspaceError error={connectionError || (callbackResult === "calendar_in_use" ? "This Google calendar is connected to another studio. Use a dedicated account or disconnect it from that studio first." : callbackResult === "calendar_changed" ? "The connection changed or a sync is running. Disconnect the current calendar before choosing another account." : callbackResult === "error" ? "Google authorization was not completed. Please connect again and approve the calendar permissions." : "")} />
      {callbackResult === "success" && sync.isSynced && !sync.syncError && <p className="workspace-info" role="status">Google Calendar is connected. Your events will synchronize with the studio calendar.</p>}
  </>;
  return (
    <div className="studio-calendar-page scheduling-workspace scheduling-calendar" data-calendar-view={view}>
      <WorkspaceHeader
        title={IS_COMMERCIAL_DEPLOYMENT ? "Calendar" : "Studio calendar"}
        description="Plan your shoots, consultations and crew assignments."
      >
        {canSchedule && <button className="studio-button primary" onClick={openNew} disabled={identityLoading}>
          <Plus size={15} />
          Schedule event
        </button>}
      </WorkspaceHeader>
      {creationRequest && !canSchedule && <p className="workspace-info" role="status">Your workspace access allows you to view events. Ask a studio administrator to schedule this session.</p>}
      {!IS_COMMERCIAL_DEPLOYMENT && googleConnection}
      <WorkspaceError error={error} retry={reload} />
      {returnTo && <Link className="studio-button small calendar-return-link" to={returnTo}><ChevronLeft size={15} /> Back to previous page</Link>}
      {eventId && !loading && !error && !linkedEvent && <WorkspaceError error="This event could not be found. It may have been removed or is no longer accessible." />}
      <section className="studio-card workspace-calendar" ref={calendarPanel}>
        <div className="workspace-calendar-heading">
          <div className="workspace-calendar-nav">
            <div className="workspace-calendar-paging">
              <button
                className="studio-icon-button"
                aria-label={view === "week" ? "Previous week" : "Previous month"}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <h2>
                {rangeLabel}
              </h2>
              <button
                className="studio-icon-button"
                aria-label={view === "week" ? "Next week" : "Next month"}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <button
              className="studio-button small"
              onClick={() => {
                const today = studioDayKey(new Date(), timezone);
                setMonth(today.slice(0, 7));
                setSelected(today);
                if (view === "agenda") setAgendaScope("day");
              }}
            >
              Today
            </button>
          </div>
          <div className="studio-tabs workspace-view-tabs" data-section-selector={IS_COMMERCIAL_DEPLOYMENT ? "pill" : undefined} role="group" aria-label="Calendar view">
            {(IS_COMMERCIAL_DEPLOYMENT ? ["week", "month", "agenda"] : ["month", "agenda"]).map((mode) => (
              <button
                key={mode}
                className={view === mode ? "active" : ""}
                onClick={() => { setView(mode); if (mode === "agenda") setAgendaScope("month"); }}
                aria-pressed={view === mode}
              >
                {mode === "week" ? "Week" : mode === "month" ? "Month" : "Agenda"}
              </button>
            ))}
            {IS_COMMERCIAL_DEPLOYMENT && <SectionSelectionIndicator selection={view} />}
          </div>
        </div>
        <div className="studio-toolbar scheduling-calendar-filters">
          <WorkspaceSearch
            value={query}
            onChange={setQuery}
            placeholder="Search events or locations…"
          />
          <label className="scheduling-filter-field"><span>Crew</span><StudioSelect
            className="studio-input workspace-select"
            aria-label="Filter calendar crew"
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
          >
            <option value="all">All crew</option>
            {crew.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </StudioSelect></label>
          {(query.trim() || crewFilter !== 'all') && <button type="button" className="studio-button scheduling-clear-filters" onClick={() => { setQuery(''); setCrewFilter('all'); }}>Clear filters</button>}
        </div>
        {nextEvent && <ScheduledWorkAction
          title={'Next event · ' + nextEvent.title}
          detail={[dateLabel(eventStartDay(nextEvent, timezone)), eventTime(nextEvent), nextEvent.location || 'Venue to confirm'].join(' · ')}
          action="Review event"
          onOpen={() => {
            const day = eventStartDay(nextEvent, timezone);
            setMonth(day.slice(0, 7));
            setSelected(day);
            setDetail(nextEvent);
          }}
        />}
        <div className="sx-calendar-motion-surface">
        {view === 'agenda' && <div className="workspace-agenda-heading"><div><h3 ref={dayHeading} tabIndex={-1}>{agendaScope === 'day' ? dateLabel(selected) : 'Agenda for ' + dateLabel(`${month}-01`, { month: 'long', year: 'numeric', day: undefined })}</h3><p className="studio-muted">{agendaEvents.length} {agendaEvents.length === 1 ? 'event' : 'events'} · {timezone}</p></div>{agendaScope === 'day' && <button type="button" className="studio-button small" onClick={() => setAgendaScope('month')}>Show whole month</button>}</div>}
        {loading ? (
          <WorkspaceEmpty loading />
        ) : view === "week" ? (
          <CalendarWeek selected={selected} today={todayKey} events={visible} timezone={timezone} time={time} openEvent={setDetail} onSelectDay={openDayAgenda} />
        ) : view === "month" ? (
          <>
            <div className="workspace-calendar-scroll">
              <div
                className="workspace-calendar-grid"
                role="group"
                aria-label="Studio month calendar"
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div
                    className="workspace-weekday"
                    key={day}
                  >
                    {day}
                  </div>
                ))}
                {days.map((day) => {
                  const dayEvents = eventsByDay.get(day);
                  return (
                    <div
                      role="group"
                      aria-label={dayLabels.get(day)}
                      className={
                        "workspace-calendar-day" +
                        (day.slice(0, 7) !== month ? " outside" : "") +
                        (day === selected ? " selected" : "")
                      }
                      key={day}
                    >
                      <button
                        className={
                          "workspace-day-number" +
                          (day === todayKey ? " today" : "")
                        }
                        aria-label={"Select " + dayLabels.get(day) + (dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : '')}
                        aria-pressed={day === selected}
                        onClick={() => setSelected(day)}
                      >
                        <span>{Number(day.slice(8, 10))}</span>
                        <span className="workspace-calendar-day-count" aria-hidden="true">
                          {dayEvents.length > 0 && <i />}
                          {dayEvents.length > 1 && <small>{dayEvents.length}</small>}
                        </span>
                      </button>
                      {dayEvents
                        .slice(0, 3)
                        .map((event) => (
                          <button
                            className={
                              "workspace-calendar-event type-" +
                              String(event.type || 'Other').toLowerCase().replace(/[^a-z]/g, "")
                            }
                            key={event._id}
                            onClick={() => setDetail(event)}
                          >
                            {event.title}
                          </button>
                        ))}
                      {dayEvents.length > 3 && (
                        <button
                          className="workspace-more-events"
                          onClick={() => openDayAgenda(day)}
                        >
                          More events →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <section className="workspace-mobile-day-events" aria-label={'Events for ' + dateLabel(selected)}>
              <h3>{dateLabel(selected)}</h3>
              <p>Tap a day to review its events.</p>
              {selectedEvents.length ? selectedEvents.map(event => (
                <button key={event._id} className="workspace-agenda-event" onClick={() => setDetail(event)}>
                  <span>
                    <strong>{event.title}</strong>
                    <small>{eventTime(event)} · {event.location || 'Location to be confirmed'}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              )) : <p className="workspace-day-empty">No events scheduled for this day.</p>}
            </section>
          </>
        ) : agendaEvents.length ? (
          <div className="workspace-agenda">
            {agendaEvents.map((event) => (
                <button
                  key={event._id}
                  className="workspace-agenda-event"
                  onClick={() => setDetail(event)}
                >
                  <span className="workspace-date-tile">
                    <small>
                      {dateLabel(eventStartDay(event, timezone), { month: "short" })}
                    </small>
                    <strong>{dateLabel(eventStartDay(event, timezone), { day: "numeric" })}</strong>
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {eventTime(event)} ·{" "}
                      {event.location || "Location to be confirmed"}
                    </small>
                    <small>
                      {(event.teamMembers || []).join(", ") ||
                        "Crew not assigned"}
                    </small>
                  </span>
                  <span className="studio-badge gold">{event.type}</span>
                </button>
              ))}
          </div>
        ) : (
          <WorkspaceEmpty
            title={query.trim() || crewFilter !== "all" ? "No matching events" : "A little space in the diary"}
            description={query.trim() || crewFilter !== "all" ? "Try another search or choose All crew." : agendaScope === 'day' ? "No events are scheduled for this selected day." : "Schedule the next shoot or consultation for this month."}
          />
        )}
        </div>
      </section>
      {IS_COMMERCIAL_DEPLOYMENT && googleConnection}
      <dl className="calendar-summary" aria-label="Calendar summary">
        <div><dt>This month</dt><dd>{loading || error ? '—' : monthEvents.length}<span>events</span></dd></div>
        <div><dt>Upcoming</dt><dd>{loading || error ? '—' : schedule.upcomingEvents.length}<span>events</span></dd></div>
        <div><dt>Crew overlaps</dt><dd>{loading || error ? '—' : schedule.conflicts.length}<span>to review</span></dd></div>
      </dl>
      <CalendarInsights key={month + timezone} monthLoad={monthLoad} dayLabels={dayLabels} selected={selected} onSelect={setSelected} loading={loading} />
      {schedule.conflicts.length > 0 && (
        <div className="workspace-info">
          <UsersRound size={17} />
          <p>
            {schedule.conflicts.length} overlapping crew assignments need
            review. {hasModuleAccess(user, 'crew') && <Link to="/admin/crew">Open Crew & scheduling →</Link>}
          </p>
        </div>
      )}
      {sync.syncError && (
        <WorkspaceError error={"Google sync: " + sync.syncError} />
      )}
      <p className="workspace-calendar-timezone">
        Times shown in {timezone}.{" "}
        {sync.lastSyncAt
          ? "Last Google sync: " + dateLabel(sync.lastSyncAt)
          : ""}
      </p>
      {canSchedule && editing !== undefined && !identityLoading && (
        <CalendarEventEditor
          key={creationRequest?.key || editing?._id || editing?.contactId || 'new-event'}
          initialData={editing}
          timezone={timezone}
          crew={crew}
          leads={leads}
          busy={busy}
          error={saveError}
          onClose={closeEditor}
          onSave={save}
        />
      )}{" "}
      {detail && (
        <WorkspaceDialog
          title={detail.title}
          onClose={closeDetail}
          footer={
            <>
              {canSchedule && !detail.isReadOnly && (
                <>
                  {canRemove && <button
                    className="studio-button danger"
                    onClick={() => {
                      setDeleting(detail);
                      closeDetail();
                      setSaveError("");
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>}
                  <button
                    className="studio-button primary"
                    onClick={() => {
                      setEditing(detail);
                      closeDetail();
                      setSaveError("");
                    }}
                  >
                    <Pencil size={14} />
                    Edit event
                  </button>
                </>
              )}
            </>
          }
        >
          <div className="workspace-event-detail">
            <p>
              <CalendarDays size={16} />
              {dateLabel(eventStartDay(detail, timezone))} · {eventTime(detail)}
            </p>
            <p>
              <MapPin size={16} />
              {detail.location || "Location not set"}
            </p>
            <p>
              <UsersRound size={16} />
              {(detail.teamMembers || []).join(", ") || "Crew not assigned"}
            </p>
            <p className="workspace-preserve">
              {detail.description || "No shoot notes recorded."}
            </p>
            {detail.isReadOnly && (
              <span className="studio-badge">
                Managed by Google · read only
              </span>
            )}
          </div>
        </WorkspaceDialog>
      )}
      {canRemove && deleting && (
        <WorkspaceDialog
          title="Remove this studio event?"
          onClose={() => setDeleting(null)}
          onSubmit={remove}
          busy={busy}
          error={saveError}
          submitLabel="Remove event"
        >
          <p>
            {deleting.title} will be removed from the studio calendar and its
            linked Google calendar when synchronization is available.
          </p>
        </WorkspaceDialog>
      )}
    </div>
  );
}
