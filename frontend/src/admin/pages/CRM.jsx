import StudioSelect from '../components/common/StudioSelect';
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Plus, Search, ArrowUpRight, Users, RefreshCw, CalendarDays, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { invoiceForLead, invoiceDestination } from "../components/operations/invoiceNavigation";
import StudioLeadForm from "../components/studio/StudioLeadForm";
import StudioLeadDetails from "../components/studio/StudioLeadDetails";
import { studioApi, studioAuth, LEAD_STATUSES, money, displayDate, initials, statusClass, matchesLead, mergeLead } from "../components/studio/leadUtils";
import "../studio-crm.css";
import { safeStudioReturn } from '../../utils/studioNavigation';
import {WorkspaceActionMenu} from '../components/operations/WorkspaceActionMenu';
import { quotationStatus } from '../../utils/quotationStatus';

function ProjectCell({ lead }) {
  const id = lead.studioProjectId?._id || lead.studioProjectId;
  const name = lead.projectName || lead.eventType || "To be confirmed";
  return <><strong>{id ? <Link className="studio-crm-text-link" to={`/admin/studio-projects/${id}`} onClick={event => event.stopPropagation()}>{name}</Link> : name}</strong><small>{lead.projectName && lead.eventType ? `${lead.eventType} · ` : ""}{displayDate(lead.eventDate, "Date to be confirmed")}</small></>;
}
function QuoteState({ lead }) {
  const id = lead.quotationId?._id || lead.quotationId;
  const quote = { ...(lead.quotationId && typeof lead.quotationId === 'object' ? lead.quotationId : {}), status: lead.quotationId?.status || lead.quotationStatus || 'Draft' };
  const knownValidity = quote.expiryEnabled === false || quote.validUntil || quote.expiresAt || !['Draft', 'Sent', 'Open'].includes(quote.status);
  return id ? <small><Link className="studio-crm-text-link" to={`/admin/quotations?quote=${encodeURIComponent(id)}`} title={lead.quotationNumber || "Open quotation"} onClick={event => event.stopPropagation()}>{knownValidity ? 'Quote ' + quotationStatus(quote).toLowerCase() : 'View quote'}</Link></small> : null;
}

export function EnquiriesView({ leads = [], loading = false, error = "", query = "", onQuery = () => {}, status = "All", onStatus = () => {}, sort = "newest", onSort = () => {}, onSelect = () => {}, onCreate = () => {}, onDelete = () => {}, onRefresh = () => {}, navigation = null }) {
  const open = leads.filter((lead) => !["Converted", "Archived"].includes(lead.status));
  const converted = leads.filter((lead) => lead.status === "Converted");
  const attention = open.filter((lead) => lead.status === "New" || (lead.followUpDate && new Date(lead.followUpDate) < new Date()));
  const filtered = leads.filter((lead) => (status === "All" || lead.status === status) && (matchesLead(lead, query) || [lead.projectName, lead.quotationNumber].some(value => String(value || "").toLowerCase().includes(query.toLowerCase())))).sort((a, b) => {
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    if (sort === "event") return (a.eventDate ? new Date(a.eventDate).getTime() : Infinity) - (b.eventDate ? new Date(b.eventDate).getTime() : Infinity);
    if (sort === "value") return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
    if (sort === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  return <>
    <div className="studio-page-heading"><div><span className="studio-eyebrow">CLIENT RELATIONSHIPS</span><h1>Enquiries</h1><p className="studio-muted">Track clients, project details and quotation progress.</p></div><button className="studio-button primary" onClick={onCreate}><Plus size={17} />New enquiry</button></div>
    {navigation}
    <section className="studio-card studio-crm-table-card" aria-label="Enquiry pipeline">
      <div className="studio-crm-card-heading"><div><h2>Enquiry pipeline</h2><p className="studio-muted">Projects and quotations stay linked to their enquiry.</p></div><Link className="studio-crm-text-link" to="/admin/studio-projects">View projects <ArrowUpRight size={15} /></Link></div>
      <div className="studio-toolbar studio-crm-toolbar"><label className="studio-search"><Search size={17} /><input aria-label="Search enquiries" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search names, email or location…" /></label><div className="studio-crm-toolbar-actions"><label className="studio-crm-select-wrap"><StudioSelect aria-label="Sort enquiries" className="studio-input" value={sort} onChange={(event) => onSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="event">Event date</option><option value="name">Client name</option><option value="value">Project value</option></StudioSelect><ChevronDown size={14} /></label><button className="studio-icon-button" aria-label="Refresh enquiries" title="Refresh enquiries" onClick={onRefresh}><RefreshCw size={16} /></button></div></div>
      <div className="studio-phone-filter"><StudioSelect aria-label="Filter by enquiry stage" value={status} onChange={event=>onStatus(event.target.value)}>{["All",...LEAD_STATUSES].map(stage=><option key={stage} value={stage}>{stage==="All"?"All enquiries":stage} · {stage==="All"?leads.length:leads.filter(lead=>lead.status===stage).length}</option>)}</StudioSelect></div><div className="studio-crm-stage-filters" aria-label="Filter by enquiry stage">{["All", ...LEAD_STATUSES].map((stage) => <button key={stage} aria-pressed={status === stage} onClick={() => onStatus(stage)} className={status === stage ? "active" : ""}>{stage === "All" ? "All enquiries" : stage}<span>{stage === "All" ? leads.length : leads.filter((lead) => lead.status === stage).length}</span></button>)}</div>
      {error ? <div className="studio-error studio-crm-load-error" role="alert"><p>{error}</p><button className="studio-button small" onClick={onRefresh}>Try again</button></div> : <div className="studio-crm-table-scroll"><table role="table" aria-label="Enquiries" className="studio-table studio-crm-table studio-phone-record-table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Client</th><th role="columnheader">Project & date</th><th role="columnheader">Stage</th><th role="columnheader">Project value</th><th role="columnheader">Next follow-up</th><th role="columnheader"><span className="studio-crm-sr-only">Actions</span></th></tr></thead><tbody role="rowgroup">
        {loading ? <tr role="row"><td role="cell" colSpan="6"><div className="studio-empty"><RefreshCw size={25} className="studio-crm-spin" /><h3>Loading your enquiries…</h3><p>Bringing the latest conversations into view.</p></div></td></tr> : filtered.length ? filtered.map((lead) => <tr role="row" key={lead._id} onClick={() => onSelect(lead)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) onSelect(lead); }} className="studio-crm-clickable-row"><td role="cell" data-label="Client"><div className="studio-crm-client"><span className="studio-crm-avatar">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>{lead.email}</small></div></div></td><td role="cell" data-label="Project & date"><ProjectCell lead={lead} /></td><td role="cell" data-label="Stage"><span className={`studio-badge studio-crm-badge ${statusClass(lead.status)}`}>{lead.status || "New"}</span><QuoteState lead={lead} /></td><td role="cell" data-label="Project value"><strong>{money(lead.totalAmount)}</strong><small>{lead.paymentStatus || "Unpaid"}</small></td><td role="cell" data-label="Follow-up"><span className={`studio-crm-followup-cell ${lead.followUpDate && new Date(lead.followUpDate) < new Date() ? "overdue" : ""}`}>{lead.followUpDate && <CalendarDays size={13} />}{displayDate(lead.followUpDate, "—")}</span></td><td role="cell" data-label="Actions"><div className="studio-crm-row-actions"><button className="studio-icon-button" aria-label={`Open ${lead.name}`} onClick={(event) => { event.stopPropagation(); onSelect(lead); }}><ArrowUpRight size={18} /><span className="studio-phone-action-label">Open enquiry</span></button>{!(lead.studioProjectId&&lead.status==='Archived')&&<span onClick={event=>event.stopPropagation()}><WorkspaceActionMenu label="More" ariaLabel={`Options for ${lead.name}`}><button type="button" onClick={()=>onSelect(lead)}>Open enquiry</button><button type="button" onClick={()=>onDelete(lead)}>{lead.studioProjectId?'Archive enquiry':'Delete enquiry'}</button></WorkspaceActionMenu></span>}</div></td></tr>) : <tr role="row"><td role="cell" colSpan="6"><div className="studio-empty"><Users size={28} /><h3>{leads.length ? "No enquiries match your search" : "No enquiries yet"}</h3><p>{leads.length ? "Try another name or enquiry stage." : "Add your first enquiry and keep every detail in one place."}</p>{!leads.length && <button className="studio-button primary" onClick={onCreate}><Plus size={16} />Add an enquiry</button>}</div></td></tr>}
      </tbody></table></div>}
      {!loading && !error && <div className="studio-crm-table-footer"><span>Showing {filtered.length} of {leads.length} enquiries</span></div>}
    </section>
    <details className="studio-details-section"><summary>Enquiry insights</summary>    <div className="studio-metric-grid studio-crm-metrics">
      <div className="studio-metric"><span>Open enquiries</span><strong>{loading ? "—" : open.length}</strong><small>Conversations in progress</small></div>
      <div className="studio-metric"><span>Needs attention</span><strong>{loading ? "—" : attention.length}</strong><small>New enquiries & overdue follow-ups</small></div>
      <div className="studio-metric"><span>Booked projects</span><strong>{loading ? "—" : converted.length}</strong><small>Accepted quotes and confirmed bookings</small></div>
      <div className="studio-metric"><span>Pipeline value</span><strong>{loading ? "—" : money(open.reduce((sum, lead) => sum + (Number(lead.totalAmount) || 0), 0))}</strong><small>Across your open enquiries</small></div>
    </div>
</details>
  </>;
}

export default function CRM() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const requestedLeadId = searchParams.get('lead');
  const activeLead = requestedLeadId ? leads.find(lead => lead._id === requestedLeadId) || (selectedLead?._id === requestedLeadId ? selectedLead : null) : null;
  const returnTo = searchParams.get('returnTo');
  const [leadFormOpen, setShowLeadForm] = useState(false);
  const showLeadForm = leadFormOpen || searchParams.get("new") === "1";
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [previousUrlSearch, setPreviousUrlSearch] = useState(searchParams.get("search") || "");
  const urlSearch = searchParams.get("search") || "";
  if (previousUrlSearch !== urlSearch) { setPreviousUrlSearch(urlSearch); setSearchQuery(urlSearch); }
  const [filterStatus, setFilterStatus] = useState(() => LEAD_STATUSES.includes(searchParams.get("stage")) ? searchParams.get("stage") : "All");
  const [sortBy, setSortBy] = useState("newest");
  const fetchLeads = () => axios.get(`${studioApi}/api/leads`, studioAuth())
    .then(({ data }) => { setLeads(Array.isArray(data) ? data : []); setError(""); })
    .catch(() => setError("We couldn’t load your enquiries. Please check your connection and try again."))
    .finally(() => setLoading(false));
  const fetchInvoices = () => axios.get(`${studioApi}/api/invoices`, studioAuth())
    .then(({ data }) => { setInvoices(Array.isArray(data) ? data : []); })
    .catch(() => {});
  useEffect(() => { fetchLeads(); fetchInvoices(); }, []);

  const updateLead = (next) => {
    setLeads((previous) => previous.map((lead) => lead._id === next._id ? mergeLead(lead, next) : lead));
    setSelectedLead((previous) => previous?._id === next._id ? mergeLead(previous, next) : previous);
  };
  const createLead = (lead) => setLeads((previous) => [lead, ...previous]);
  const closeLeadForm = () => { setShowLeadForm(false); if (searchParams.has("new")) { const next = new URLSearchParams(searchParams); next.delete("new"); setSearchParams(next, { replace: true }); } };
  const deleteLead = async (lead) => {
    if (lead.studioProjectId) {
      if (!window.confirm(`Archive the enquiry for ${lead.name}? The linked project and documents will be retained.`)) return;
      try {
        const { data } = await axios.patch(`${studioApi}/api/leads/${lead._id}`, { status:"Archived" }, studioAuth());
        updateLead(data); toast.success("Enquiry archived");
      } catch { toast.error("Couldn’t archive the enquiry"); }
      return;
    }
    if (!window.confirm(`Permanently delete the enquiry for ${lead.name}? This cannot be undone.`)) return;
    try { await axios.delete(`${studioApi}/api/leads/${lead._id}`, studioAuth()); setLeads((previous) => previous.filter((item) => item._id !== lead._id)); toast.success("Enquiry deleted"); }
    catch { toast.error("Couldn’t delete the enquiry"); }
  };
  const openInvoice = lead => navigate(invoiceDestination(invoices, lead));
  const selectLead = lead => {
    setSelectedLead(lead);
    const next = new URLSearchParams(searchParams);
    next.set('lead', lead._id);
    setSearchParams(next);
  };
  const closeLead = () => {
    setSelectedLead(null);
    if (returnTo) { navigate(safeStudioReturn(returnTo)); return; }
    const next = new URLSearchParams(searchParams);
    next.delete('lead');
    next.delete('returnTo');
    setSearchParams(next, { replace: true });
  };
  return <div className="studio-crm">
    {requestedLeadId && !loading && !error && !activeLead && <div className="studio-error" role="status"><span>This enquiry is unavailable or has been removed.</span><Link className="studio-button small" to={safeStudioReturn(returnTo)}>Back to overview</Link></div>}
    <EnquiriesView leads={leads} loading={loading} error={error} query={searchQuery} onQuery={setSearchQuery} status={filterStatus} onStatus={setFilterStatus} sort={sortBy} onSort={setSortBy} onSelect={selectLead} onCreate={() => setShowLeadForm(true)} onDelete={deleteLead} onRefresh={() => { setLoading(true); setError(""); fetchLeads(); }} />
    {showLeadForm && <StudioLeadForm onClose={closeLeadForm} onSaved={createLead} />}
    {activeLead && <StudioLeadDetails lead={activeLead} onClose={closeLead} onUpdate={updateLead} onGenerateInvoice={openInvoice} existingInvoice={invoiceForLead(invoices, activeLead)} />}
  </div>;
}
