import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { X, CalendarDays, MapPin, Mail, Phone, ArrowUpRight, Pencil, Check, Plus, Trash2, Circle, CheckCircle2, Users, Wallet, FolderOpen, FileText, Loader2 } from "lucide-react";
import StudioLeadForm from "./StudioLeadForm";
import useStudioDialog from "./useStudioDialog";
import { studioApi, studioAuth, initials, statusClass, displayDate, dateInput, money, paidAmount, remainingAmount, populatedTasks, mergeLead } from "./leadUtils";

function TaskWorkspace({ lead, onChange }) {
  const tasks = populatedTasks(lead);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const inFlight = useRef(false);
  const updateTasks = (next) => onChange({ ...lead, tasks: next });

  const add = async (event) => {
    event.preventDefault();
    if (!title.trim() || inFlight.current) return;
    inFlight.current = true;
    setBusy("new");
    try {
      const response = await axios.post(`${studioApi}/api/leads/${lead._id}/tasks`, { title: title.trim(), dueDate: dueDate || null, status: "pending" }, studioAuth());
      updateTasks([...tasks, response.data]);
      setTitle(""); setDueDate(""); toast.success("Task added");
    } catch { toast.error("Couldn’t add the task"); } finally { setBusy(null); inFlight.current = false; }
  };
  const update = async (task, payload) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(task._id);
    try {
      const response = await axios.patch(`${studioApi}/api/tasks/${task._id}`, payload, studioAuth());
      updateTasks(tasks.map((item) => item._id === task._id ? response.data : item));
      setEditing(null);
    } catch { toast.error("Couldn’t update the task"); } finally { setBusy(null); inFlight.current = false; }
  };
  const remove = async (task) => {
    if (inFlight.current) return;
    if (!window.confirm(`Delete task “${task.title}”?`)) return;
    inFlight.current = true;
    setBusy(task._id);
    try { await axios.delete(`${studioApi}/api/tasks/${task._id}`, studioAuth()); updateTasks(tasks.filter((item) => item._id !== task._id)); }
    catch { toast.error("Couldn’t delete the task"); } finally { setBusy(null); inFlight.current = false; }
  };
  return <section className="studio-card studio-crm-detail-card">
    <div className="studio-crm-section-heading"><div><span className="studio-eyebrow">THE WORK AHEAD</span><h3>Project checklist</h3></div><span className="studio-badge">{tasks.filter((task) => task.status !== "completed").length} open</span></div>
    <form className="studio-crm-task-form" onSubmit={add}><input aria-label="New task title" className="studio-input" placeholder="Add a task for this project…" value={title} onChange={(event) => setTitle(event.target.value)} required /><input aria-label="Task due date" type="date" className="studio-input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><button className="studio-button primary" disabled={busy === "new"}><Plus size={16} />Add task</button></form>
    <div className="studio-crm-task-list">{tasks.length ? tasks.map((task) => <div className={`studio-crm-task ${task.status === "completed" ? "completed" : ""}`} key={task._id}>
      <button className="studio-icon-button" aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`} disabled={busy === task._id} onClick={() => update(task, { status: task.status === "completed" ? "pending" : "completed" })}>{task.status === "completed" ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
      {editing === task._id ? <form className="studio-crm-task-edit" onSubmit={(event) => { event.preventDefault(); if (editTitle.trim()) update(task, { title: editTitle.trim(), dueDate: editDueDate || null }); }}><input aria-label="Edit task title" autoFocus required className="studio-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /><input aria-label="Edit task due date" type="date" className="studio-input" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} /><button className="studio-icon-button" aria-label="Save task" disabled={busy === task._id}><Check size={17} /></button><button type="button" className="studio-icon-button" aria-label="Cancel task edit" onClick={() => setEditing(null)}><X size={17} /></button></form> : <><div className="studio-crm-task-title"><strong>{task.title}</strong>{task.dueDate && <small>Due {displayDate(task.dueDate)}</small>}</div><button className="studio-icon-button" aria-label={`Edit ${task.title}`} onClick={() => { setEditing(task._id); setEditTitle(task.title); setEditDueDate(dateInput(task.dueDate)); }}><Pencil size={15} /></button><button className="studio-icon-button" aria-label={`Delete ${task.title}`} disabled={busy === task._id} onClick={() => remove(task)}><Trash2 size={15} /></button></>}
    </div>) : <div className="studio-crm-inline-empty"><CheckCircle2 size={22} /><p>No tasks yet. Add the next step above.</p></div>}</div>
  </section>;
}

export default function StudioLeadDetails({ lead: initialLead, onClose, onUpdate, onGenerateInvoice, existingInvoice, isProject = false }) {
  const [lead, setLead] = useState(initialLead);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [photographers, setPhotographers] = useState([]);
  const [crew, setCrew] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const dialogRef = useStudioDialog(onClose, { canClose: !saving });
  const [notes, setNotes] = useState(initialLead.notes || "");
  const [followUp, setFollowUp] = useState(dateInput(initialLead.followUpDate));
  const [delivery, setDelivery] = useState({ cloudLink: initialLead.cloudLink || "", cloudPassword: initialLead.cloudPassword || "" });

  useEffect(() => {
    axios.get(`${studioApi}/api/photographers`, studioAuth()).then(({ data }) => setPhotographers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const sync = (updated) => {
    const next = mergeLead(lead, updated);
    setLead(next); onUpdate(next);
  };
  const patch = async (payload, success) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const { data } = await axios.patch(`${studioApi}/api/leads/${lead._id}`, payload, studioAuth());
      sync(data);
      if (success) toast.success(success);
    } catch { toast.error("Couldn’t save these changes. Please try again."); } finally { setSaving(false); inFlight.current = false; }
  };
  const addCrew = (event) => { event.preventDefault(); if (!crew || (lead.people || []).includes(crew)) return; patch({ people: [...(lead.people || []), crew] }, "Crew member assigned"); setCrew(""); };
  const tasks = populatedTasks(lead);
  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const safeCloudLink = /^https?:\/\//i.test(lead.cloudLink || "") ? lead.cloudLink : null;

  return createPortal(<div className="studio-modal-overlay studio-crm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="studio-modal studio-crm-detail" role="dialog" aria-modal="true" aria-labelledby="studio-lead-detail-title">
      <header className="studio-crm-detail-header"><div className="studio-crm-detail-identity"><span className="studio-crm-avatar large">{initials(lead.name)}</span><div><span className="studio-eyebrow">{isProject ? "PROJECT WORKSPACE" : "ENQUIRY DETAILS"}</span><h2 id="studio-lead-detail-title">{lead.name}</h2><span className={`studio-badge studio-crm-badge ${statusClass(lead.status)}`}>{lead.status}</span></div></div><div className="studio-crm-detail-actions"><button className="studio-button small" onClick={() => setEditing(true)}><Pencil size={15} />Edit details</button><button className="studio-icon-button" aria-label="Close details" onClick={onClose}><X size={21} /></button></div></header>
      <div className="studio-tabs studio-crm-detail-tabs">{[{ id: "overview", title: "Overview" }, { id: "tasks", title: `Tasks${tasks.length ? ` · ${tasks.length}` : ""}` }, { id: "delivery", title: "Delivery" }].map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.title}</button>)}</div>
      <div className="studio-crm-detail-body">
        {tab === "overview" && <div className="studio-crm-detail-grid"><div className="studio-crm-detail-stack">
          <section className="studio-card studio-crm-detail-card"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">THE OCCASION</span><h3>{lead.eventType || "Event details"}</h3></div><Link className="studio-icon-button" to="/admin/calendar" aria-label="Open calendar"><ArrowUpRight size={18} /></Link></div><div className="studio-crm-facts"><div><CalendarDays size={18} /><span><small>EVENT DATE</small><strong>{displayDate(lead.eventDate)}{lead.eventTime && ` · ${lead.eventTime}`}</strong></span></div><div><MapPin size={18} /><span><small>VENUE</small><strong>{lead.eventLocation || "Venue to be confirmed"}</strong></span></div><div><Mail size={18} /><span><small>EMAIL ADDRESS</small><a href={`mailto:${lead.email}`}>{lead.email || "Not provided"}</a></span></div><div><Phone size={18} /><span><small>PHONE NUMBER</small>{lead.phone ? <a href={`tel:${lead.phone.replace(/[^0-9+]/g, "")}`}>{lead.phone}</a> : <strong>Not provided</strong>}</span></div></div>{lead.remarks && <div className="studio-crm-brief"><small>CREATIVE BRIEF</small><p>{lead.remarks}</p></div>}</section>
          <section className="studio-card studio-crm-detail-card"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">THE PEOPLE BEHIND IT</span><h3>Assigned crew</h3></div><Users size={19} /></div><div className="studio-crm-crew-list">{(lead.people || []).length ? lead.people.map((name) => <div key={name} className="studio-crm-crew-member"><span className="studio-crm-avatar">{initials(name)}</span><strong>{name}</strong><button className="studio-icon-button" aria-label={`Remove ${name} from crew`} disabled={saving} onClick={() => { if (window.confirm(`Remove ${name} from this project?`)) patch({ people: lead.people.filter((person) => person !== name) }, "Crew updated"); }}><X size={15} /></button></div>) : <p className="studio-muted">Assign the right people when the project is ready.</p>}</div><form onSubmit={addCrew} className="studio-crm-assign"><select aria-label="Select a crew member" className="studio-input" value={crew} onChange={(event) => setCrew(event.target.value)} required><option value="">Select a crew member</option>{photographers.filter((person) => !(lead.people || []).includes(person.name)).map((person) => <option key={person._id} value={person.name}>{person.name}</option>)}</select><button className="studio-button" disabled={!crew || saving}><Plus size={16} />Assign</button></form></section>
          <section className="studio-card studio-crm-detail-card"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">FOR YOUR TEAM</span><h3>Studio notes</h3></div></div><form onSubmit={(event) => { event.preventDefault(); patch({ notes }, "Notes saved"); }}><textarea aria-label="Internal studio notes" rows={4} className="studio-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Decisions, preferences and details to remember…" /><div className="studio-crm-card-footer"><button className="studio-button small" disabled={saving || notes === (lead.notes || "")}>Save notes</button></div></form></section>
        </div><div className="studio-crm-detail-stack">
          <section className="studio-card studio-crm-detail-card studio-crm-payment"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">PROJECT FINANCES</span><h3>Payment summary</h3></div><Wallet size={19} /></div><span className={`studio-badge studio-crm-badge ${statusClass(lead.paymentStatus)}`}>{lead.paymentStatus || "Unpaid"}</span><div className="studio-crm-payment-value">{money(lead.totalAmount)}<small>PROJECT VALUE</small></div><dl><div><dt>Received</dt><dd>{money(paidAmount(lead))}</dd></div><div><dt>Balance due</dt><dd>{money(remainingAmount(lead))}</dd></div></dl><div className="studio-crm-payment-progress"><span style={{ width: `${Number(lead.totalAmount) > 0 ? Math.min(100, paidAmount(lead) / Number(lead.totalAmount) * 100) : 0}%` }} /></div>{onGenerateInvoice && <button className="studio-button studio-crm-full-button" onClick={() => onGenerateInvoice(lead)}><FileText size={16} />{existingInvoice ? "View invoice" : "Create invoice"}<ArrowUpRight size={15} /></button>}<Link className="studio-crm-text-link" to="/admin/finance">Open finance <ArrowUpRight size={14} /></Link></section>
          <section className="studio-card studio-crm-detail-card"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">KEEP IN TOUCH</span><h3>Next follow-up</h3></div></div><p className="studio-crm-followup-date">{displayDate(lead.followUpDate, "No follow-up scheduled")}</p><form onSubmit={(event) => { event.preventDefault(); patch({ followUpDate: followUp || null, ...(lead.status !== "Converted" && lead.status !== "Archived" && followUp ? { status: "Follow-up" } : {}) }, followUp ? "Follow-up scheduled" : "Follow-up cleared"); }}><input aria-label="Next follow-up date" type="date" className="studio-input" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /><div className="studio-crm-card-footer"><button className="studio-button small" disabled={saving}>Save follow-up</button>{lead.followUpDate && <button type="button" className="studio-crm-text-link" onClick={() => { setFollowUp(""); patch({ followUpDate: null }, "Follow-up completed"); }} disabled={saving}>Mark complete</button>}</div></form></section>
          <section className="studio-card studio-crm-detail-card"><span className="studio-eyebrow">WORKFLOW</span><div className="studio-crm-workflow-number">{completed}<small> / {tasks.length} tasks</small></div><div className="studio-crm-payment-progress"><span style={{ width: `${progress}%` }} /></div><button className="studio-crm-text-link" onClick={() => setTab("tasks")}>Manage checklist <ArrowUpRight size={14} /></button></section>
        </div></div>}
        {tab === "tasks" && <TaskWorkspace lead={lead} onChange={(next) => { setLead(next); onUpdate(next); }} />}
        {tab === "delivery" && <div className="studio-crm-detail-grid"><section className="studio-card studio-crm-detail-card"><div className="studio-crm-section-heading"><div><span className="studio-eyebrow">THE FINISHED STORY</span><h3>Cloud delivery</h3></div><FolderOpen size={20} /></div><p className="studio-muted studio-crm-delivery-help">Keep the delivery folder details with this project.</p><form onSubmit={(event) => { event.preventDefault(); patch(delivery, "Delivery access saved"); }}><label className="studio-field studio-crm-wide-field">Cloud folder link<input type="url" className="studio-input" value={delivery.cloudLink} onChange={(event) => setDelivery({ ...delivery, cloudLink: event.target.value })} placeholder="https://" /></label><label className="studio-field studio-crm-wide-field">Cloud folder password<input className="studio-input" value={delivery.cloudPassword} onChange={(event) => setDelivery({ ...delivery, cloudPassword: event.target.value })} autoComplete="off" /></label><div className="studio-crm-card-footer"><button className="studio-button primary" disabled={saving}>{saving && <Loader2 size={15} className="studio-crm-spin" />}Save delivery access</button></div></form></section><div className="studio-crm-detail-stack">{safeCloudLink ? <a className="studio-card studio-crm-destination" href={safeCloudLink} target="_blank" rel="noreferrer"><span className="studio-crm-destination-icon"><FolderOpen size={23} /></span><div><h3>Open cloud folder</h3><p>View the delivery folder for this client.</p></div><ArrowUpRight size={19} /></a> : <div className="studio-card studio-crm-detail-card"><FolderOpen size={24} /><h3>Cloud folder pending</h3><p className="studio-muted">Add a folder link when the deliverables are ready.</p></div>}</div></div>}
      </div>
      {editing && <StudioLeadForm initialData={lead} onClose={() => setEditing(false)} onSaved={(next) => { sync(next); setNotes(next.notes || ""); setFollowUp(dateInput(next.followUpDate)); setDelivery({ cloudLink: next.cloudLink || "", cloudPassword: next.cloudPassword || "" }); }} />}
    </section>
  </div>, document.body);
}
