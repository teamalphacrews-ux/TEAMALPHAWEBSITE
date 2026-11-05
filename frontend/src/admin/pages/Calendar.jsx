import { hasModuleAccess, hasFullModuleAccess } from '../../utils/moduleAccess';
import StudioSelect from '../components/common/StudioSelect';
import { useEffect, useState, useRef } from "react";
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
import CalendarInsights from "../components/calendar/CalendarInsights";
import { calendarMonthGrid, calendarMonthLoad, shiftCalendarMonth } from "../components/calendar/calendarData";
import { safeStudioReturn } from '../../utils/studioNavigation';
import { deriveCrewSchedule } from "../components/operations/crewSchedule";
import { operationAPI } from "../components/operations/operationsUtils";
import { useAuth } from "../../context/AuthContext";
import { useStudioIdentity } from "../../utils/studioIdentity";
import { eventOnStudioDay, eventStartDay, studioDayKey, studioDateTimeToISO } from "../../utils/studioTime";
import { eventScheduleLabel } from "../../utils/eventSchedule";
import { useStudioPreferences } from '../components/common/StudioPreferences';
import { formatWorkspaceDate, formatWorkspaceTime, resolveWorkspaceTimezone } from '../../utils/workspaceLocale';
import '../components/calendar/calendarRefinements.css';
import './calendarWorkspace.css';
import './schedulingRefinement.css';
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
function CalendarEventEditor({ timezone, ...props }) {
  // One editing session uses one resolved zone. Later settings refreshes must
  // not remount the form or reinterpret a time the user has already entered.
  const [editorTimezone] = useState(timezone);
  return <EventForm key={editorTimezone} timezone={editorTimezone} {...props} />;
}
export default function Calendar() {
  const { user } = useAuth();
  const { identity, loading: identityLoading } = useStudioIdentity();
  const { preferences } = useStudioPreferences();
  const timezone = resolveWorkspaceTimezone(preferences, identity?.timezone);
  const time = value => formatWorkspaceTime(value, preferences, identity?.timezone);
  const dateLabel = (key, options) => formatWorkspaceDate(key, preferences, identity?.timezone, options);
  const eventTime = event => eventScheduleLabel(event, timezone, { date: dateLabel, time });
  const isPreview = user?.isPreview === true;
  const [sessionParams, setSessionParams]=useSearchParams();
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/calendar",
    hasModuleAccess(user, 'crew') ? '/api/photographers' : null,
    hasModuleAccess(user, 'enquiries') ? '/api/leads' : null,
  ]);
  const [events = [], crew = [], leads = []] = data;
  const eventId = sessionParams.get('event');
  const linkedEvent = events.find(event => String(event._id) === eventId);
  const linkedDay = linkedEvent ? eventStartDay(linkedEvent, timezone) : '';
  const connection = useWorkspaceData(["/api/calendar/sync-status"]);
  const sync = connection.data[0] || {};
  const [monthState, setMonth] = useState(null),
    [selectedState, setSelected] = useState(null),
    [view, setView] = useState(() =>
      window.innerWidth < 680 ? "agenda" : "month",
    ),
    [agendaScope, setAgendaScope] = useState("month"),
    [query, setQuery] = useState(""),
    [crewFilter, setCrewFilter] = useState("all"),
    [editingState, setEditing] = useState(()=>sessionParams.get("new")==="1"?{}:sessionParams.get("contact")?{
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
  const editing = editingState && !editingState.start ? { ...editingState, start: studioDateTimeToISO(`${selected}T10:00`, timezone), end: studioDateTimeToISO(`${selected}T11:00`, timezone) } : editingState;
  const detail = linkedEvent || detailState;
  const setupMessage = isPreview ? GOOGLE_PREVIEW_MESSAGE : sync.setupMessage || "";
  const googleStatus = connection.loading ? 'Checking connection…' : connection.error ? 'Connection unavailable' : isPreview ? 'Sample preview' : sync.configured === false ? 'Setup required' : sync.isSynced ? sync.syncError ? 'Reconnect required' : 'Connected' : 'Not connected';
  useEffect(() => {
    if (!hasFullModuleAccess(user)) return;
    let socket, cancelled = false;
    const connect = () => { if (cancelled) return; socket = io(operationAPI + (user?.workspace?.id ? '/studio-' + user.workspace.id : ''), { auth: { token: localStorage.getItem('token') } }); socket.on('calendar_update', reload); };
    // The access check initializes the namespace before an authenticated studio connects.
    if (user?.workspace?.id) workspaceRequest('/api/saas/workspace').then(connect).catch(() => {});
    else connect();
    return () => { cancelled = true; socket?.disconnect(); };
  }, [reload, user, user?.workspace?.id]);
  const visible = events.filter(
    (event) =>
      (crewFilter === "all" ||
        (event.teamMembers || []).includes(crewFilter)) &&
      [event.title, event.location, event.type]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const days = calendarMonthGrid(month);
  const selectedEvents = visible
    .filter((event) => eventOnStudioDay(event, selected, timezone))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const monthEvents = calendarMonthLoad(visible, month, timezone).events;
  const agendaEvents = agendaScope === 'day' ? selectedEvents : [...monthEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
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
  const schedule = deriveCrewSchedule(crew, events, now);
  const changeMonth = (offset) => {
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
  const newRequest=useRef('');
  useEffect(()=>{if(sessionParams.get('new')!=='1'||newRequest.current===sessionParams.toString())return;
    const signature=sessionParams.toString();let active=true;Promise.resolve().then(()=>{if(active){newRequest.current=signature;openNew();}});return()=>{active=false;};
    // Existing openNew uses the configured studio timezone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionParams,timezone]);

  const save = async (values) => {
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const result = await workspaceRequest(
        editing?._id ? "patch" : "post",
        "/api/calendar" + (editing?._id ? "/" + editing._id : ""),
        values,
      );
      setEditing(undefined);
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
    if (busy) return;
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
      const result = await workspaceRequest("get", "/api/auth/google");
      window.location.assign(googleCalendarHandoff(result, operationAPI, window.location.origin));
    } catch (err) {
      setConnectionError(googleConnectionError(err));
    } finally {
      setSyncBusy(false);
    }
  };
  return (
    <div className="studio-calendar-page scheduling-workspace scheduling-calendar">
      <WorkspaceHeader
        title="Studio calendar"
        description="Plan your shoots, consultations and crew assignments."
      >
        <button className="studio-button primary" onClick={openNew} disabled={identityLoading}>
          <Plus size={15} />
          Schedule event
        </button>
      </WorkspaceHeader>
      <section className="scheduling-connection" aria-label="Google Calendar connection">
        <div className="scheduling-connection-copy">
          <CalendarDays size={19} aria-hidden="true" />
          <div><strong>Google Calendar <span className={'scheduling-status' + (sync.isSynced && !sync.syncError && !isPreview ? ' is-connected' : '')}>{googleStatus}</span></strong><p id="google-calendar-setup">{setupMessage || (sync.isSynced ? `${sync.email || 'Your Google account'} · Studio times use ${timezone}.` : 'Connect your Google account to keep studio events in sync.')}</p></div>
        </div>
        <button
          className="studio-button"
          onClick={sync.isSynced && !sync.syncError ? syncNow : connect}
          disabled={isPreview || syncBusy || connection.loading || sync.configured === false}
          aria-describedby={setupMessage ? "google-calendar-setup" : undefined}
        >
          <RefreshCw size={14} />
          {syncBusy
            ? sync.isSynced ? "Syncing…" : "Connecting…"
            : sync.isSynced
              ? sync.syncError ? "Reconnect Google" : "Sync Google"
              : "Connect Google"}
        </button>
      </section>
      <WorkspaceError error={connectionError || (callbackResult === "error" ? "Google authorization was not completed. Please connect again and approve the calendar permissions." : "")} />
      {callbackResult === "success" && sync.isSynced && !sync.syncError && <p className="workspace-info" role="status">Google Calendar is connected. Your events will synchronize with the studio calendar.</p>}
      <WorkspaceError error={error} retry={reload} />
      {returnTo && <Link className="studio-button small calendar-return-link" to={returnTo}><ChevronLeft size={15} /> Back to previous page</Link>}
      {eventId && !loading && !error && !linkedEvent && <WorkspaceError error="This event could not be found. It may have been removed or is no longer accessible." />}
      <section className="studio-card workspace-calendar">
        <div className="workspace-calendar-heading">
          <div className="workspace-calendar-nav">
            <div className="workspace-calendar-paging">
              <button
                className="studio-icon-button"
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <h2>
                {dateLabel(`${month}-01`, { month: "long", year: "numeric", day: undefined })}
              </h2>
              <button
                className="studio-icon-button"
                aria-label="Next month"
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
          <div className="studio-tabs workspace-view-tabs">
            {["month", "agenda"].map((mode) => (
              <button
                key={mode}
                className={view === mode ? "active" : ""}
                onClick={() => { setView(mode); if (mode === "agenda") setAgendaScope("month"); }}
                aria-pressed={view === mode}
              >
                {mode === "month" ? "Month" : "Agenda"}
              </button>
            ))}
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
        {view === 'agenda' && <div className="workspace-agenda-heading"><div><h3>{agendaScope === 'day' ? dateLabel(selected) : 'Agenda for ' + dateLabel(`${month}-01`, { month: 'long', year: 'numeric', day: undefined })}</h3><p className="studio-muted">{agendaEvents.length} {agendaEvents.length === 1 ? 'event' : 'events'} · {timezone}</p></div>{agendaScope === 'day' && <button type="button" className="studio-button small" onClick={() => setAgendaScope('month')}>Show whole month</button>}</div>}
        {loading ? (
          <WorkspaceEmpty loading />
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
                  const dayEvents = visible.filter(event => eventOnStudioDay(event, day, timezone));
                  return (
                    <div
                      role="group"
                      aria-label={dateLabel(day)}
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
                          (day === studioDayKey(new Date(), timezone) ? " today" : "")
                        }
                        aria-label={"Select " + dateLabel(day) + (dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : '')}
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
                          onClick={() => {
                            setSelected(day);
                            setAgendaScope("day");
                            setView("agenda");
                          }}
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
      </section>
      <dl className="calendar-summary" aria-label="Calendar summary">
        <div><dt>This month</dt><dd>{loading || error ? '—' : monthEvents.length}<span>events</span></dd></div>
        <div><dt>Upcoming</dt><dd>{loading || error ? '—' : schedule.upcomingEvents.length}<span>events</span></dd></div>
        <div><dt>Crew overlaps</dt><dd>{loading || error ? '—' : schedule.conflicts.length}<span>to review</span></dd></div>
      </dl>
      <CalendarInsights key={month + timezone} events={visible} month={month} selected={selected} onSelect={setSelected} loading={loading} timezone={timezone} formatDate={dateLabel} />
      {schedule.conflicts.length > 0 && (
        <div className="workspace-info">
          <UsersRound size={17} />
          <p>
            {schedule.conflicts.length} overlapping crew assignments need
            review. <Link to="/admin/crew">Open Crew & scheduling →</Link>
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
      {editing !== undefined && !identityLoading && (
        <CalendarEventEditor
          key={editing?._id || editing?.contactId || 'new-event'}
          initialData={editing}
          timezone={timezone}
          crew={crew}
          leads={leads}
          busy={busy}
          error={saveError}
          onClose={() => setEditing(undefined)}
          onSave={save}
        />
      )}{" "}
      {detail && (
        <WorkspaceDialog
          title={detail.title}
          onClose={closeDetail}
          footer={
            <>
              {!detail.isReadOnly && (
                <>
                  <button
                    className="studio-button danger"
                    onClick={() => {
                      setDeleting(detail);
                      closeDetail();
                      setSaveError("");
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
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
      {deleting && (
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
