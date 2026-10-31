import StudioButton from '../components/common/StudioButton';
import StudioSelect from '../components/common/StudioSelect';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CalendarDays, Camera, ChevronRight, Clock3, Mail, MapPin, Pencil, Phone, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { SERVICE_ROLES } from "../utils/constants";
import { OperationsError, OperationsLoading, OperationsModal } from "../components/operations/OperationsUI";
import { operationAPI, operationAuth, operationError } from "../components/operations/operationsUtils";
import { deriveCrewSchedule } from "../components/operations/crewSchedule";
import { useStudioIdentity } from '../../utils/studioIdentity';
import { formatStudioDate, formatStudioTime, studioDayBounds, eventStartDay, studioTimezone } from '../../utils/studioTime';
import { recordDestination } from '../../utils/studioNavigation';
import "./studioOperations.css";

const initials = name => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const roleLabel = role => String(role || "Crew member").toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());
const emptyForm = { name: "", email: "", phone: "", specialty: "LEAD PHOTOGRAPHER", status: "Active" };

export default function Crew() {
  const { identity } = useStudioIdentity();
  const timezone = studioTimezone(identity?.timezone);
  const timeLabel = value => formatStudioTime(value, timezone);
  const operationDate = (value, options = { day: 'numeric', month: 'short' }) => formatStudioDate(value, { day: undefined, month: undefined, year: undefined, ...options }, timezone);
  const scheduleDate = (event, options) => operationDate(studioDayBounds(eventStartDay(event, timezone), timezone).start, options);
  const [crew, setCrew] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crewError, setCrewError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const scheduleRef = useRef(null);
  const selectMember = id => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1180px)").matches) requestAnimationFrame(() => {
      scheduleRef.current?.focus({ preventScroll: true });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.studioMotion === "reduced";
      scheduleRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  };
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const fetchWorkspace = useCallback(() => {
    return Promise.allSettled([
      axios.get(`${operationAPI}/api/photographers`, operationAuth()),
      axios.get(`${operationAPI}/api/calendar`, operationAuth())
    ]).then(([crewResult, eventResult]) => {
    if (crewResult.status === "fulfilled" && Array.isArray(crewResult.value.data)) { setCrew(crewResult.value.data); setCrewError(""); }
    else setCrewError(operationError(crewResult.reason, "We couldn't load your crew roster."));
    if (eventResult.status === "fulfilled" && Array.isArray(eventResult.value.data)) { setEvents(eventResult.value.data); setCalendarError(""); }
    else setCalendarError(operationError(eventResult.reason, "The calendar is unavailable. Assignment counts and conflicts cannot be checked."));
    setLoading(false);
    });
  }, []);
  useEffect(() => { fetchWorkspace(); }, [fetchWorkspace]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const retryWorkspace = () => { setLoading(true); setCrewError(""); setCalendarError(""); fetchWorkspace(); };

  const { upcomingEvents, assignments, conflicts } = useMemo(() => deriveCrewSchedule(crew, events, now), [crew, events, now]);
  const conflictedMembers = useMemo(() => new Set(conflicts.map(conflict => conflict.member._id)), [conflicts]);
  const selectedMember = crew.find(member => member._id === selectedId);
  const visibleSchedule = selectedMember ? assignments.get(selectedMember._id) || [] : upcomingEvents;
  const visibleConflicts = selectedMember ? conflicts.filter(conflict => conflict.member._id === selectedMember._id) : conflicts;
  const filteredCrew = crew.filter(member => {
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    if (roleFilter !== "all" && member.specialty !== roleFilter) return false;
    return `${member.name} ${member.email} ${member.phone || ""} ${member.specialty || ""}`.toLowerCase().includes(query.toLowerCase().trim());
  }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const assignedEvents = upcomingEvents.filter(event => (event.teamMembers || []).length > 0);
  const openEditor = (member = null) => {
    setEditing(member); setForm(member ? { name: member.name || "", email: member.email || "", phone: member.phone || "", specialty: member.specialty || emptyForm.specialty, status: member.status || "Active" } : { ...emptyForm }); setFormError("");
  };
  const saveMember = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.email.trim()) { setFormError("Name and email are required."); return; }
    setSaving(true); setFormError("");
    try {
      const body = { ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() };
      const response = editing ? await axios.patch(`${operationAPI}/api/photographers/${editing._id}`, body, operationAuth()) : await axios.post(`${operationAPI}/api/photographers`, body, operationAuth());
      if (!response.data?._id) throw new Error("No saved crew member returned");
      setCrew(current => editing ? current.map(member => member._id === editing._id ? response.data : member) : [response.data, ...current]);
      setEditing(undefined); toast.success(editing ? "Crew profile updated." : "Crew member added.");
    } catch (error) { setFormError(operationError(error, "We couldn't save this crew member. Please try again.")); }
    finally { setSaving(false); }
  };

  return <div className="studio-ops">
    <div className="studio-page-heading"><div><p className="studio-eyebrow">People & planning</p><h1>Crew</h1><p className="studio-muted">The people behind every beautiful frame.</p></div><div className="ops-heading-actions"><Link className="studio-button" to="/admin/calendar"><CalendarDays size={15} /> Manage schedule</Link><button className="studio-button primary" onClick={() => openEditor()}><Plus size={16} /> Add crew member</button></div></div>
    <div className="studio-metric-grid ops-metrics">{[{ label: "Active crew", value: crew.filter(member => member.status === "Active").length, icon: Users, detail: `${crew.length} members in your roster`, tone: "plum" }, { label: "Upcoming events", value: calendarError ? "—" : upcomingEvents.length, icon: CalendarDays, detail: "From the shared studio calendar", tone: "gold" }, { label: "Events with crew", value: calendarError ? "—" : assignedEvents.length, icon: ShieldCheck, detail: "With at least one assigned member", tone: "sage" }, { label: "Schedule overlaps", value: calendarError ? "—" : conflicts.length, icon: AlertTriangle, detail: `${conflictedMembers.size} crew members to review`, tone: "rose" }].map(metric => <div className="studio-metric" key={metric.label}><div className="ops-metric-top"><span>{metric.label}</span><span className={`ops-metric-icon ${metric.tone}`}><metric.icon size={18} /></span></div><strong>{loading || crewError ? "—" : metric.value}</strong><small>{metric.detail}</small></div>)}</div>
    {crewError && <OperationsError onRetry={retryWorkspace}>{crewError}</OperationsError>}{calendarError && <OperationsError onRetry={retryWorkspace}>{calendarError}</OperationsError>}
    <div className="ops-workspace-grid ops-crew-grid">
      <section className="studio-card ops-roster"><div className="ops-section-heading"><div><h2 className="studio-section-title">Studio roster <span className="ops-count">{loading || crewError ? "—" : crew.length}</span></h2><p className="studio-muted">Find the right people for the next story.</p></div><Camera size={19} className="ops-quiet-icon" /></div><div className="studio-toolbar ops-crew-toolbar"><label className="studio-search ops-search"><Search size={16} /><input placeholder="Search name, role or email" aria-label="Search crew" value={query} onChange={event => setQuery(event.target.value)} /></label><StudioSelect className="studio-input ops-select" aria-label="Filter crew by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option>Active</option><option>Inactive</option></StudioSelect><StudioSelect className="studio-input ops-role-select" aria-label="Filter crew by specialty" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">All specialties</option>{SERVICE_ROLES.map(role => <option value={role} key={role}>{roleLabel(role)}</option>)}</StudioSelect></div>
      {loading ? <OperationsLoading label="Loading your studio crew…" /> : crewError && !crew.length ? <div className="studio-empty ops-empty"><Users size={32} /><h3>Crew roster unavailable</h3><p>Try again to reconnect to your studio roster.</p></div> : filteredCrew.length ? <div className="ops-table-scroll"><table role="table" aria-label="Crew roster" className="studio-table ops-crew-table studio-phone-record-table"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Crew member</th><th role="columnheader" scope="col">Specialty</th><th role="columnheader" scope="col">Assignments</th><th role="columnheader" scope="col">Status</th><th role="columnheader" scope="col"><span className="ops-sr-only">Actions</span></th></tr></thead><tbody role="rowgroup">{filteredCrew.map((member, index) => {
        const booked = assignments.get(member._id) || []; const hasConflict = conflictedMembers.has(member._id);
        return <tr role="row" key={member._id} className={selectedId === member._id ? "ops-selected-row" : ""}><td role="cell" data-label="Crew member"><div className="ops-person"><span className={`ops-avatar tone-${index % 4}`} aria-hidden="true">{initials(member.name)}</span><div><button className="ops-title-button" aria-pressed={selectedId === member._id} aria-controls="crew-schedule" onClick={() => selectMember(selectedId === member._id ? "" : member._id)}>{member.name}</button><a className="ops-person-email" href={`mailto:${member.email}`}>{member.email}</a></div></div></td><td role="cell" data-label="Specialty"><span className="ops-role-label">{roleLabel(member.specialty)}</span>{member.phone && <a className="ops-person-phone" href={`tel:${member.phone}`}><Phone size={11} />{member.phone}</a>}</td><td role="cell" data-label="Assignments"><button className="ops-assignment-button" aria-controls="crew-schedule" onClick={() => selectMember(member._id)} aria-label={`View ${member.name}'s assignments`}><CalendarDays size={13} />{calendarError ? "Unavailable" : `${booked.length} upcoming`}{hasConflict && <AlertTriangle size={13} className="ops-conflict-icon" />}</button></td><td role="cell" data-label="Status"><span className={`studio-badge ops-status ${member.status === "Active" ? "completed" : "inactive"}`}><span />{member.status || "Active"}</span></td><td role="cell" data-label="Actions"><button className="ops-icon-button" aria-label={`Edit crew member: ${member.name}`} onClick={() => openEditor(member)}><Pencil size={15} /></button></td></tr>;
      })}</tbody></table></div> : <div className="studio-empty ops-empty"><Users size={32} /><h3>{crew.length ? "No crew members match" : "Bring your people together"}</h3><p>{crew.length ? "Try a different name, specialty or status." : "Add photographers, filmmakers, editors and the people who make it all happen."}</p>{crew.length ? <button className="studio-button" onClick={() => { setQuery(""); setRoleFilter("all"); setStatusFilter("all"); }}>Clear filters</button> : <button className="studio-button" onClick={() => openEditor()}><Plus size={15} /> Add your first crew member</button>}</div>}
      <div className="ops-table-footer"><span>{loading ? "Loading…" : crewError ? "Crew data unavailable" : `${filteredCrew.length} of ${crew.length} crew members`}</span><span>Select a member to view their schedule</span></div></section>
      <aside className="ops-rail"><section className="studio-card ops-schedule-card" id="crew-schedule" ref={scheduleRef} tabIndex={-1} aria-labelledby="crew-schedule-title"><div className="ops-schedule-heading"><div><p className="studio-eyebrow">On the horizon</p><h2 id="crew-schedule-title">{selectedMember ? selectedMember.name.split(" ")[0] + "’s schedule" : "Studio schedule"}</h2></div>{selectedMember && <button className="ops-icon-button" aria-label="Show all crew schedules" aria-controls="crew-schedule" onClick={() => selectMember("")}><X size={16} /></button>}</div><p className="studio-muted">{selectedMember ? roleLabel(selectedMember.specialty) : "Upcoming bookings from your calendar"} · {timezone}</p><div className="ops-schedule-list">{loading ? <OperationsLoading label="Loading assignments…" /> : calendarError ? <div className="ops-rail-empty"><CalendarDays size={25} /><p>Schedule unavailable.</p><small>Retry the calendar connection to check assignments.</small></div> : visibleSchedule.length ? visibleSchedule.slice(0, 5).map(event => <Link to={recordDestination("event", event._id, "/admin/crew")} className="ops-schedule-event" key={event._id}><span className="ops-date-block"><small>{scheduleDate(event, { month: "short" })}</small><strong>{scheduleDate(event, { day: "2-digit" })}</strong></span><span className="ops-schedule-event-body"><strong>{event.title}</strong><small><Clock3 size={11} />{event.allDay === true ? "All day" : `${timeLabel(event.start)} – ${timeLabel(event.end)}`}</small>{event.location && <small><MapPin size={11} />{event.location}</small>}<span className="ops-event-team"><Users size={11} />{(event.teamMembers || []).length ? event.teamMembers.join(", ") : "Crew not assigned"}</span></span><ChevronRight size={14} className="ops-event-arrow" /></Link>) : <div className="ops-rail-empty"><CalendarDays size={25} /><p>No upcoming assignments.</p><small>{selectedMember ? "Assign this member to an event in Calendar." : "New events will appear here once scheduled."}</small></div>}</div><Link className="ops-text-link" to="/admin/calendar">{visibleSchedule.length > 5 ? `View all ${visibleSchedule.length} events` : "Open studio calendar"}<ArrowUpRight size={14} /></Link></section>
      <section className={`studio-card ops-conflicts-card ${visibleConflicts.length ? "has-conflicts" : ""}`}><div className="ops-conflicts-heading"><span className="ops-metric-icon rose"><AlertTriangle size={17} /></span><h3>Schedule check</h3></div>{loading ? <p className="studio-muted">Checking calendar assignments…</p> : calendarError || crewError ? <p className="studio-muted">Calendar and crew data are needed to check for overlaps.</p> : visibleConflicts.length ? <><p className="studio-muted">{visibleConflicts.length} overlapping {visibleConflicts.length === 1 ? "booking needs" : "bookings need"} a closer look.</p><div className="ops-conflict-list">{visibleConflicts.slice(0, 3).map(conflict => <div className="ops-conflict-item" key={`${conflict.member._id}-${conflict.first._id}-${conflict.second._id}`}><strong>{conflict.member.name}</strong><p>{conflict.first.title} <span>&</span> {conflict.second.title}</p><small>{operationDate(conflict.second.start, { day: "numeric", month: "short", year: "numeric" })} · Overlapping times</small></div>)}</div><Link className="ops-text-link" to="/admin/calendar">Review in Calendar <ArrowUpRight size={14} /></Link></> : <div className="ops-clear-schedule"><ShieldCheck size={25} /><strong>No overlapping assignments</strong><p>Upcoming events are checked against each crew member’s assigned times.</p></div>}</section></aside>
    </div>
    {editing !== undefined && <OperationsModal title={editing ? "Edit crew member" : "Add crew member"} description="A few details to keep your studio connected." onClose={() => setEditing(undefined)} busy={saving} footer={<><button className="studio-button" disabled={saving} onClick={() => setEditing(undefined)}>Cancel</button><StudioButton variant="primary" type="submit" form="crew-profile-form" loading={saving} loadingLabel="Saving crew member">{editing ? "Save changes" : "Add crew member"}</StudioButton></>}><form id="crew-profile-form" className="ops-form" onSubmit={saveMember}>{formError && <OperationsError>{formError}</OperationsError>}<label className="studio-field"><span>Full name <b>*</b></span><input required maxLength={100} className="studio-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Crew member’s name" /></label><div className="studio-form-grid"><label className="studio-field"><span>Email address <b>*</b></span><div className="ops-input-icon"><Mail size={15} /><input className="studio-input" type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></div></label><label className="studio-field"><span>Phone number</span><div className="ops-input-icon"><Phone size={15} /><input type="tel" className="studio-input" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+91" /></div></label></div><div className="studio-form-grid"><label className="studio-field"><span>Specialty</span><StudioSelect title="Specialty" className="studio-input" value={form.specialty} onChange={event => setForm({ ...form, specialty: event.target.value })}>{SERVICE_ROLES.map(role => <option value={role} key={role}>{roleLabel(role)}</option>)}</StudioSelect></label><label className="studio-field"><span>Status</span><StudioSelect title="Status" className="studio-input" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></StudioSelect></label></div>{editing && form.name.trim() !== editing.name && <p className="ops-form-note">Calendar assignments are saved by name. Update existing bookings in Calendar after renaming this crew member.</p>}</form></OperationsModal>}
  </div>;
}
