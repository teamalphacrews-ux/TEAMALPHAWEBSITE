import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, CalendarDays, MapPin, ArrowUpRight, RefreshCw, FolderOpen, Users, Image, Wallet, ChevronDown, List, LayoutGrid } from "lucide-react";
import StudioLeadDetails from "../components/studio/StudioLeadDetails";
import InvoiceForm from "../components/crm/InvoiceForm";
import { studioApi, studioAuth, money, displayDate, initials, remainingAmount, populatedTasks, matchesLead, mergeLead, statusClass } from "../components/studio/leadUtils";
import "../studio-crm.css";

export function ProjectsView({ projects = [], loading = false, error = "", onSelect = () => {}, onRefresh = () => {} }) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [period, setPeriod] = useState("all");
  const [payment, setPayment] = useState("all");
  const [view, setView] = useState("grid");
  const today = new Date().setHours(0, 0, 0, 0);
  const upcoming = projects.filter((project) => project.eventDate && new Date(project.eventDate).getTime() >= today);
  const totalBalance = projects.reduce((sum, project) => sum + remainingAmount(project), 0);
  const filtered = projects.filter((project) => matchesLead(project, query) && (payment === "all" || project.paymentStatus === payment) && (period === "all" || (period === "upcoming" && project.eventDate && new Date(project.eventDate).getTime() >= today) || (period === "past" && project.eventDate && new Date(project.eventDate).getTime() < today) || (period === "unscheduled" && !project.eventDate))).sort((a, b) => (a.eventDate ? new Date(a.eventDate).getTime() : Infinity) - (b.eventDate ? new Date(b.eventDate).getTime() : Infinity));
  return <>
    <div className="studio-page-heading"><div><span className="studio-eyebrow">FROM PROMISE TO PHOTOGRAPHS</span><h1>Stories in the making.</h1><p className="studio-muted">A considered home for every booked celebration.</p></div><Link className="studio-button" to="/admin/crm">View enquiries <ArrowUpRight size={16} /></Link></div>
    <div className="studio-metric-grid studio-crm-metrics">
      <div className="studio-metric"><span>Booked projects</span><strong>{loading ? "—" : projects.length}</strong><small>Every confirmed client, in one place</small></div>
      <div className="studio-metric"><span>Upcoming occasions</span><strong>{loading ? "—" : upcoming.length}</strong><small>Dates to look forward to</small></div>
      <div className="studio-metric"><span>Open tasks</span><strong>{loading ? "—" : projects.reduce((sum, project) => sum + populatedTasks(project).filter((task) => task.status !== "completed").length, 0)}</strong><small>The details that keep things moving</small></div>
      <div className="studio-metric"><span>Balance to collect</span><strong>{loading ? "—" : money(totalBalance)}</strong><small>Across all booked projects</small></div>
    </div>
    <section className="studio-crm-project-section">
      <div className="studio-crm-project-heading"><div><h2>Your projects <span>{projects.length}</span></h2><p className="studio-muted">The team, the timeline, the final collection.</p></div><div className="studio-crm-view-toggle" aria-label="Project display"><button className={view === "grid" ? "active" : ""} aria-label="Show project cards" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={16} /></button><button className={view === "list" ? "active" : ""} aria-label="Show project list" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} /></button></div></div>
      <div className="studio-toolbar studio-crm-project-toolbar"><label className="studio-search"><Search size={17} /><input aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, venue or crew…" /></label><div className="studio-crm-toolbar-actions"><label className="studio-crm-select-wrap"><select aria-label="Filter project dates" className="studio-input" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All dates</option><option value="upcoming">Upcoming occasions</option><option value="past">Past occasions</option><option value="unscheduled">Date to be confirmed</option></select><ChevronDown size={14} /></label><label className="studio-crm-select-wrap"><select aria-label="Filter project payment" className="studio-input" value={payment} onChange={(event) => setPayment(event.target.value)}><option value="all">All payments</option><option>Unpaid</option><option>Deposit Paid</option><option>Paid</option></select><ChevronDown size={14} /></label><button className="studio-icon-button" aria-label="Refresh projects" onClick={onRefresh}><RefreshCw size={16} /></button></div></div>
      {error ? <div className="studio-error studio-crm-load-error" role="alert"><p>{error}</p><button className="studio-button small" onClick={onRefresh}>Try again</button></div> : loading ? <div className="studio-card studio-empty"><RefreshCw size={26} className="studio-crm-spin" /><h3>Gathering your projects…</h3><p>Bringing every booked story into view.</p></div> : !filtered.length ? <div className="studio-card studio-empty"><FolderOpen size={30} /><h3>{projects.length ? "No projects match your filters" : "Your next chapter starts here"}</h3><p>{projects.length ? "Try another name, date or payment status." : "Converted enquiries appear here as booked projects."}</p>{!projects.length && <Link className="studio-button primary" to="/admin/crm">Open enquiries <ArrowUpRight size={16} /></Link>}</div> : view === "grid" ? <div className="studio-crm-project-grid">{filtered.map((project) => {
        const tasks = populatedTasks(project);
        const complete = tasks.filter((task) => task.status === "completed").length;
        return <article key={project._id} className="studio-card studio-crm-project-card"><div className="studio-crm-project-card-top"><span className="studio-crm-avatar large">{initials(project.name)}</span><span className={`studio-badge studio-crm-badge ${statusClass(project.paymentStatus)}`}>{project.paymentStatus || "Unpaid"}</span></div><button className="studio-crm-project-title" onClick={() => onSelect(project)}><h3>{project.name}</h3><ArrowUpRight size={19} /></button><span className="studio-crm-project-type">{project.eventType || "Celebration"}</span><div className="studio-crm-project-facts"><p><CalendarDays size={15} />{displayDate(project.eventDate, "Date to be confirmed")}</p><p><MapPin size={15} />{project.eventLocation || "Venue to be confirmed"}</p></div><div className="studio-crm-project-crew"><div className="studio-crm-crew-avatars">{(project.people || []).slice(0, 3).map((person) => <span className="studio-crm-avatar" key={person} title={person}>{initials(person)}</span>)}</div><button onClick={() => onSelect(project)}>{project.people?.length ? `${project.people.length} crew ${project.people.length === 1 ? "member" : "members"}` : "Assign your crew"}<ArrowUpRight size={13} /></button></div><div className="studio-crm-project-progress"><div><span>Project checklist</span><strong>{complete} / {tasks.length}</strong></div><div className="studio-crm-payment-progress"><span style={{ width: `${tasks.length ? complete / tasks.length * 100 : 0}%` }} /></div></div><div className="studio-crm-project-money"><div><small>PROJECT VALUE</small><strong>{money(project.totalAmount)}</strong></div><div><small>BALANCE DUE</small><strong>{money(remainingAmount(project))}</strong></div></div><div className="studio-crm-project-links"><Link to="/admin/calendar" title="Open calendar"><CalendarDays size={15} /><span>Calendar</span></Link><button onClick={() => onSelect(project)} title="Manage project crew"><Users size={15} /><span>Crew</span></button><Link to="/admin/gallery" title="Open galleries"><Image size={15} /><span>Gallery</span></Link><Link to="/admin/finance" title="Open finance"><Wallet size={15} /><span>Finance</span></Link></div></article>;
      })}</div> : <div className="studio-card studio-crm-table-scroll"><table className="studio-table studio-crm-table"><thead><tr><th>Project</th><th>Occasion</th><th>Crew</th><th>Payment</th><th>Balance due</th><th>Workspace</th></tr></thead><tbody>{filtered.map((project) => <tr key={project._id}><td><div className="studio-crm-client"><span className="studio-crm-avatar">{initials(project.name)}</span><div><strong>{project.name}</strong><small>{project.eventType || "Celebration"}</small></div></div></td><td><strong>{displayDate(project.eventDate)}</strong><small>{project.eventLocation || "Venue to be confirmed"}</small></td><td>{project.people?.length || 0} assigned</td><td><span className={`studio-badge studio-crm-badge ${statusClass(project.paymentStatus)}`}>{project.paymentStatus || "Unpaid"}</span></td><td><strong>{money(remainingAmount(project))}</strong></td><td><button className="studio-button small" onClick={() => onSelect(project)}>Open <ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div>}
      {!loading && !error && <div className="studio-crm-project-count">Showing {filtered.length} of {projects.length} booked projects</div>}
    </section>
  </>;
}

export default function Projects() {
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceClient, setInvoiceClient] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const fetchProjects = () => axios.get(`${studioApi}/api/leads`, studioAuth())
    .then(({ data }) => { setLeads(Array.isArray(data) ? data : []); setError(""); })
    .catch(() => setError("We couldn’t load your projects. Please check your connection and try again."))
    .finally(() => setLoading(false));
  const fetchInvoices = () => axios.get(`${studioApi}/api/invoices`, studioAuth())
    .then(({ data }) => setInvoices(Array.isArray(data) ? data : []))
    .catch(() => {});
  useEffect(() => { fetchProjects(); fetchInvoices(); }, []);
  const update = (next) => { setLeads((previous) => previous.map((lead) => lead._id === next._id ? mergeLead(lead, next) : lead)); setSelected((previous) => previous?._id === next._id ? mergeLead(previous, next) : previous); };
  const openInvoice = (project) => { setInvoice(invoices.find((item) => item.clientName === project.name) || null); setInvoiceClient(project.name); setShowInvoice(true); };
  return <div className="studio-crm"><ProjectsView projects={leads.filter((lead) => lead.status === "Converted")} loading={loading} error={error} onSelect={setSelected} onRefresh={() => { setLoading(true); setError(""); fetchProjects(); }} />{selected && <StudioLeadDetails lead={selected} isProject onClose={() => setSelected(null)} onUpdate={update} onGenerateInvoice={openInvoice} existingInvoice={invoices.find((item) => item.clientName === selected.name)} />}{showInvoice && <div className="studio-modal-overlay studio-crm-invoice-overlay"><InvoiceForm initialData={invoice} initialClientName={invoiceClient} onClose={() => { setShowInvoice(false); fetchInvoices(); }} /></div>}</div>;
}
