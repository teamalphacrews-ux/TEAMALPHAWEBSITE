import { useEffect, useState } from "react";
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
import { calendarMonthLoad } from "../components/operations/insightData";
import { deriveCrewSchedule } from "../components/operations/crewSchedule";
import { operationAPI } from "../components/operations/operationsUtils";
import { useAuth } from "../../context/AuthContext";
import { GOOGLE_PREVIEW_MESSAGE, googleCalendarHandoff, googleConnectionError } from "../components/calendar/googleConnection";
import {
  WorkspaceHeader,
  WorkspaceMetrics,
  WorkspaceError,
  WorkspaceSearch,
  WorkspaceEmpty,
  WorkspaceDialog,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
  recordDate,
} from "../components/operations/workspaceData";
const keyDate = (value) => {
  const d = new Date(value);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const time = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
export default function Calendar() {
  const { user } = useAuth();
  const isPreview = user?.isPreview === true;
  const [sessionParams]=useSearchParams();
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/calendar",
    "/api/photographers",
    "/api/leads",
  ]);
  const [events = [], crew = [], leads = []] = data;
  const connection = useWorkspaceData(["/api/calendar/sync-status"]);
  const sync = connection.data[0] || {};
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [selected, setSelected] = useState(() => keyDate(new Date())),
    [view, setView] = useState(() =>
      window.innerWidth < 680 ? "agenda" : "month",
    ),
    [query, setQuery] = useState(""),
    [crewFilter, setCrewFilter] = useState("all"),
    [editing, setEditing] = useState(()=>sessionParams.get("contact")?{
      title:"Client session",type:"Meeting",contactId:sessionParams.get("contact"),studioProjectId:sessionParams.get("project")||null,
      start:new Date(new Date().setHours(10,0,0,0)).toISOString(),end:new Date(new Date().setHours(11,0,0,0)).toISOString(),
    }:undefined),
    [detail, setDetail] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [syncBusy, setSyncBusy] = useState(false),
    [connectionError, setConnectionError] = useState("");
  const callbackResult = sessionParams.get("sync");
  const setupMessage = isPreview ? GOOGLE_PREVIEW_MESSAGE : sync.setupMessage || "";
  useEffect(() => {
    const socket = io(operationAPI, {
      auth: { token: localStorage.getItem("token") },
    });
    socket.on("calendar_update", reload);
    return () => socket.disconnect();
  }, [reload]);
  const visible = events.filter(
    (event) =>
      (crewFilter === "all" ||
        (event.teamMembers || []).includes(crewFilter)) &&
      [event.title, event.location, event.type]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const first = new Date(month);
  first.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const d = new Date(first);
    d.setDate(d.getDate() + index);
    return d;
  });
  const inDay = (event, day) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return new Date(event.start) < end && new Date(event.end) > start;
  };
  const monthEvents = calendarMonthLoad(visible, month).events;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const schedule = deriveCrewSchedule(crew, events, now);
  const openNew = () => {
    const start = new Date(selected + "T10:00:00");
    const end = new Date(selected + "T18:00:00");
    setEditing({ start: start.toISOString(), end: end.toISOString() });
    setSaveError("");
  };
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
    <div>
      <WorkspaceHeader
        eyebrow="MAKE ROOM FOR EVERY STORY"
        title="Studio calendar"
        description="Shoots, consultations and crew assignments in one place."
      >
        <button
          className="studio-button"
          onClick={sync.isSynced ? syncNow : connect}
          disabled={isPreview || syncBusy || connection.loading || sync.configured === false}
          aria-describedby={setupMessage ? "google-calendar-setup" : undefined}
        >
          <RefreshCw size={14} />
          {syncBusy
            ? sync.isSynced ? "Syncing…" : "Connecting…"
            : sync.isSynced
              ? "Sync Google"
              : "Connect Google"}
        </button>
        {sync.isSynced && sync.syncError && <button className="studio-button" onClick={connect} disabled={isPreview || syncBusy}>Reconnect Google</button>}
        <button className="studio-button primary" onClick={openNew}>
          <Plus size={14} />
          Schedule event
        </button>
      </WorkspaceHeader>
      {setupMessage && <aside id="google-calendar-setup" className="workspace-info" role="status">{setupMessage}</aside>}
      <WorkspaceError error={connectionError || (callbackResult === "error" ? "Google authorization was not completed. Please connect again and approve the calendar permissions." : "")} />
      {callbackResult === "success" && sync.isSynced && !sync.syncError && <p className="workspace-info" role="status">Google Calendar is connected. Your events will synchronize with the studio calendar.</p>}
      <WorkspaceMetrics
        loading={loading || (!!error && !data.length)}
        items={[
          {
            label: "This month",
            value: monthEvents.length,
            note: "Events in the selected month",
          },
          {
            label: "Upcoming events",
            value: schedule.upcomingEvents.length,
            note: "From the shared studio calendar",
          },
          {
            label: "Crew overlaps",
            value: schedule.conflicts.length,
            note: "Assignments to review",
          },
          {
            label: "Google Calendar",
            value: connection.loading
              ? "Checking…"
              : connection.error
                ? "Unavailable"
                : isPreview
                  ? "Preview only"
                : sync.configured === false
                  ? "Setup required"
                : sync.isSynced
                  ? sync.syncError ? "Needs attention" : "Connected"
                  : "Not connected",
            note: sync.isSynced
              ? sync.email
              : "Your studio calendar remains available",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      <CalendarInsights key={month.getFullYear() + "-" + month.getMonth()} events={visible} month={month} selected={selected} onSelect={setSelected} loading={loading} />
      <section className="studio-card workspace-calendar">
        <div className="workspace-calendar-heading">
          <div className="workspace-calendar-nav">
            <button
              className="studio-icon-button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={17} />
            </button>
            <h2>
              {month.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              className="studio-icon-button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={17} />
            </button>
            <button
              className="studio-button small"
              onClick={() => {
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                );
                setSelected(keyDate(new Date()));
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
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
              >
                {mode === "month" ? "Month" : "Agenda"}
              </button>
            ))}
          </div>
        </div>
        <div className="studio-toolbar">
          <WorkspaceSearch
            value={query}
            onChange={setQuery}
            placeholder="Search events or locations…"
          />
          <select
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
          </select>
        </div>
        {loading ? (
          <WorkspaceEmpty loading />
        ) : view === "month" ? (
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
              {days.map((day) => (
                <div
                  role="group"
                  aria-label={recordDate(day)}
                  className={
                    "workspace-calendar-day" +
                    (day.getMonth() !== month.getMonth() ? " outside" : "") +
                    (keyDate(day) === selected ? " selected" : "")
                  }
                  key={keyDate(day)}
                >
                  <button
                    className={
                      "workspace-day-number" +
                      (keyDate(day) === keyDate(new Date()) ? " today" : "")
                    }
                    aria-label={"Select " + recordDate(day)}
                    aria-pressed={keyDate(day) === selected}
                    onClick={() => setSelected(keyDate(day))}
                  >
                    {day.getDate()}
                  </button>
                  {visible
                    .filter((event) => inDay(event, day))
                    .slice(0, 3)
                    .map((event) => (
                      <button
                        className={
                          "workspace-calendar-event type-" +
                          event.type.toLowerCase().replace(/[^a-z]/g, "")
                        }
                        key={event._id}
                        onClick={() => setDetail(event)}
                      >
                        {event.title}
                      </button>
                    ))}
                  {visible.filter((event) => inDay(event, day)).length > 3 && (
                    <button
                      className="workspace-more-events"
                      onClick={() => {
                        setSelected(keyDate(day));
                        setView("agenda");
                      }}
                    >
                      More events →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : monthEvents.length ? (
          <div className="workspace-agenda">
            {monthEvents
              .sort((a, b) => new Date(a.start) - new Date(b.start))
              .map((event) => (
                <button
                  key={event._id}
                  className="workspace-agenda-event"
                  onClick={() => setDetail(event)}
                >
                  <span className="workspace-date-tile">
                    <small>
                      {new Date(event.start).toLocaleDateString("en-IN", {
                        month: "short",
                      })}
                    </small>
                    <strong>{new Date(event.start).getDate()}</strong>
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {time(event.start)} – {time(event.end)} ·{" "}
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
            description={query.trim() || crewFilter !== "all" ? "Try another search or choose All crew." : "Schedule the next shoot or consultation for this month."}
          />
        )}
      </section>
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
        Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.{" "}
        {sync.lastSyncAt
          ? "Last Google sync: " + recordDate(sync.lastSyncAt)
          : ""}
      </p>
      {editing !== undefined && (
        <EventForm
          key={editing?._id || selected}
          initialData={editing}
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
          onClose={() => setDetail(null)}
          footer={
            <>
              {!detail.isReadOnly && (
                <>
                  <button
                    className="studio-button danger"
                    onClick={() => {
                      setDeleting(detail);
                      setDetail(null);
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
                      setDetail(null);
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
              {recordDate(detail.start)} · {time(detail.start)} –{" "}
              {time(detail.end)}
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
