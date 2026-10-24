import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Plus, Search, ArrowUpRight, Trash2, Archive, FileText, Users, RefreshCw, CalendarDays, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { invoiceForLead, invoiceDestination } from "../components/operations/invoiceNavigation";
import StudioLeadForm from "../components/studio/StudioLeadForm";
import StudioLeadDetails from "../components/studio/StudioLeadDetails";
import { studioApi, studioAuth, LEAD_STATUSES, money, displayDate, initials, statusClass, matchesLead, mergeLead } from "../components/studio/leadUtils";
import "../studio-crm.css";

function ProjectCell({ lead }) {
  const id = lead.studioProjectId?._id || lead.studioProjectId;
  const name = lead.projectName || lead.eventType || "To be confirmed";
  return <><strong>{id ? <Link className="studio-crm-text-link" to={`/admin/studio-projects/${id}`} onClick={event => event.stopPropagation()}>{name}</Link> : name}</strong><small>{lead.projectName && lead.eventType ? `${lead.eventType} · ` : ""}{displayDate(lead.eventDate, "Date to be confirmed")}</small></>;
}
function QuoteState({ lead }) {
  const id = lead.quotationId?._id || lead.quotationId;
  return id ? <small><Link className="studio-crm-text-link" to={`/admin/quotations?quote=${encodeURIComponent(id)}`} title={lead.quotationNumber || "Open quotation"} onClick={event => event.stopPropagation()}>Quote {(lead.quotationStatus || "Draft").toLowerCase()}</Link></small> : null;
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
    <div className="studio-metric-grid studio-crm-metrics">
      <div className="studio-metric"><span>Open enquiries</span><strong>{loading ? "—" : open.length}</strong><small>Conversations in progress</small></div>
      <div className="studio-metric"><span>Needs attention</span><strong>{loading ? "—" : attention.length}</strong><small>New enquiries & overdue follow-ups</small></div>
      <div className="studio-metric"><span>Booked projects</span><strong>{loading ? "—" : converted.length}</strong><small>Accepted quotes and confirmed bookings</small></div>
      <div className="studio-metric"><span>Pipeline value</span><strong>{loading ? "—" : money(open.reduce((sum, lead) => sum + (Number(lead.totalAmount) || 0), 0))}</strong><small>Across your open enquiries</small></div>
    </div>
    <section className="studio-card studio-crm-table-card" aria-label="Enquiry pipeline">
      <div className="studio-crm-card-heading"><div><h2>Enquiry pipeline</h2><p className="studio-muted">Projects and quotations stay linked to their enquiry.</p></div><Link className="studio-crm-text-link" to="/admin/studio-projects">View projects <ArrowUpRight size={15} /></Link></div>
      <div className="studio-toolbar studio-crm-toolbar"><label className="studio-search"><Search size={17} /><input aria-label="Search enquiries" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search names, email or location…" /></label><div className="studio-crm-toolbar-actions"><label className="studio-crm-select-wrap"><select aria-label="Sort enquiries" className="studio-input" value={sort} onChange={(event) => onSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="event">Event date</option><option value="name">Client name</option><option value="value">Project value</option></select><ChevronDown size={14} /></label><button className="studio-icon-button" aria-label="Refresh enquiries" title="Refresh enquiries" onClick={onRefresh}><RefreshCw size={16} /></button></div></div>
      <div className="studio-crm-stage-filters" aria-label="Filter by enquiry stage">{["All", ...LEAD_STATUSES].map((stage) => <button key={stage} aria-pressed={status === stage} onClick={() => onStatus(stage)} className={status === stage ? "active" : ""}>{stage === "All" ? "All enquiries" : stage}<span>{stage === "All" ? leads.length : leads.filter((lead) => lead.status === stage).length}</span></button>)}</div>
      {error ? <div className="studio-error studio-crm-load-error" role="alert"><p>{error}</p><button className="studio-button small" onClick={onRefresh}>Try again</button></div> : <div className="studio-crm-table-scroll"><table className="studio-table studio-crm-table"><thead><tr><th>Client</th><th>Project & date</th><th>Stage</th><th>Project value</th><th>Next follow-up</th><th><span className="studio-crm-sr-only">Actions</span></th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6"><div className="studio-empty"><RefreshCw size={25} className="studio-crm-spin" /><h3>Loading your enquiries…</h3><p>Bringing the latest conversations into view.</p></div></td></tr> : filtered.length ? filtered.map((lead) => <tr key={lead._id} onClick={() => onSelect(lead)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) onSelect(lead); }} className="studio-crm-clickable-row"><td><div className="studio-crm-client"><span className="studio-crm-avatar">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>{lead.email}</small></div></div></td><td><ProjectCell lead={lead} /></td><td><span className={`studio-badge studio-crm-badge ${statusClass(lead.status)}`}>{lead.status || "New"}</span><QuoteState lead={lead} /></td><td><strong>{money(lead.totalAmount)}</strong><small>{lead.paymentStatus || "Unpaid"}</small></td><td><span className={`studio-crm-followup-cell ${lead.followUpDate && new Date(lead.followUpDate) < new Date() ? "overdue" : ""}`}>{lead.followUpDate && <CalendarDays size={13} />}{displayDate(lead.followUpDate, "—")}</span></td><td><div className="studio-crm-row-actions"><button className="studio-icon-button" aria-label={`Open ${lead.name}`} onClick={(event) => { event.stopPropagation(); onSelect(lead); }}><ArrowUpRight size={18} /></button>{!(lead.studioProjectId && lead.status === "Archived") && <button className="studio-icon-button studio-crm-delete" aria-label={`${lead.studioProjectId ? "Archive" : "Delete"} ${lead.name}`} onClick={(event) => { event.stopPropagation(); onDelete(lead); }}>{lead.studioProjectId ? <Archive size={15} /> : <Trash2 size={15} />}</button>}</div></td></tr>) : <tr><td colSpan="6"><div className="studio-empty"><Users size={28} /><h3>{leads.length ? "No enquiries match your search" : "No enquiries yet"}</h3><p>{leads.length ? "Try another name or enquiry stage." : "Add your first enquiry and keep every detail in one place."}</p>{!leads.length && <button className="studio-button primary" onClick={onCreate}><Plus size={16} />Add an enquiry</button>}</div></td></tr>}
      </tbody></table></div>}
      {!loading && !error && <div className="studio-crm-table-footer"><span>Showing {filtered.length} of {leads.length} enquiries</span></div>}
    </section>
  </>;
}

export default function CRM() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chosenTab, setActiveTab] = useState("leads");
  const activeTab = searchParams.get("new") === "1" || chosenTab !== "invoices" ? "leads" : "invoices";
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
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
    .then(({ data }) => { setInvoices(Array.isArray(data) ? data : []); setInvoiceError(""); })
    .catch(() => setInvoiceError("We couldn’t load your invoices. Please try again."));
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
  const deleteInvoice = async (invoice) => {
    if (!window.confirm(`Permanently delete the invoice for ${invoice.clientName}?`)) return;
    try { await axios.delete(`${studioApi}/api/invoices/${invoice._id}`, studioAuth()); setInvoices((previous) => previous.filter((item) => item._id !== invoice._id)); toast.success("Invoice deleted"); }
    catch { toast.error("Couldn’t delete the invoice"); }
  };

  const navigation = <div className="studio-tabs studio-crm-main-tabs">{[{ id: "leads", title: "Enquiries", icon: <Users size={15} /> }, { id: "invoices", title: "Invoices", icon: <FileText size={15} /> }].map(({ id, title, icon }) => <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{icon}{title}</button>)}</div>;

  return <div className="studio-crm">
    {activeTab === "invoices" && <div className="studio-page-heading"><div><span className="studio-eyebrow">CLIENT RELATIONSHIPS</span><h1>A clear view of every commitment.</h1><p className="studio-muted">Your studio, connected and considered.</p></div><button className="studio-button primary" onClick={() => navigate("/admin/invoices/new")}><Plus size={17} />New invoice</button></div>}
    {activeTab !== "leads" && navigation}
    {activeTab === "leads" && <EnquiriesView leads={leads} loading={loading} error={error} query={searchQuery} onQuery={setSearchQuery} status={filterStatus} onStatus={setFilterStatus} sort={sortBy} onSort={setSortBy} onSelect={setSelectedLead} onCreate={() => setShowLeadForm(true)} onDelete={deleteLead} onRefresh={() => { setLoading(true); setError(""); fetchLeads(); }} navigation={navigation} />}
    {activeTab === "invoices" && <section className="studio-card studio-crm-table-card"><div className="studio-crm-card-heading"><div><h2>Invoices</h2><p className="studio-muted">{invoices.length} client {invoices.length === 1 ? "invoice" : "invoices"}</p></div><button className="studio-icon-button" aria-label="Refresh invoices" onClick={fetchInvoices}><RefreshCw size={16} /></button></div>{invoiceError ? <div className="studio-error studio-crm-load-error" role="alert">{invoiceError}<button className="studio-button small" onClick={fetchInvoices}>Try again</button></div> : <div className="studio-crm-table-scroll"><table className="studio-table studio-crm-table"><thead><tr><th>Client</th><th>Invoice date</th><th>Status</th><th>Invoice total</th><th>Actions</th></tr></thead><tbody>{invoices.length ? invoices.map((invoice) => <tr key={invoice._id}><td><strong>{invoice.clientName}</strong></td><td>{displayDate(invoice.invoiceDate)}</td><td><span className={`studio-badge studio-crm-badge ${statusClass(invoice.status)}`}>{invoice.status}</span></td><td><strong>{money(invoice.total)}</strong></td><td><div className="studio-crm-row-actions"><button className="studio-button small" onClick={() => navigate("/admin/invoices/" + invoice._id)}><FileText size={14} />View invoice</button><button className="studio-icon-button" aria-label={`Delete invoice for ${invoice.clientName}`} onClick={() => deleteInvoice(invoice)}><Trash2 size={15} /></button></div></td></tr>) : <tr><td colSpan="5"><div className="studio-empty"><FileText size={28} /><h3>No invoices yet</h3><p>Create an invoice from an enquiry or add one above.</p></div></td></tr>}</tbody></table></div>}</section>}
    {showLeadForm && <StudioLeadForm onClose={closeLeadForm} onSaved={createLead} />}
    {selectedLead && <StudioLeadDetails lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={updateLead} onGenerateInvoice={openInvoice} existingInvoice={invoiceForLead(invoices, selectedLead)} />}
  </div>;
}
