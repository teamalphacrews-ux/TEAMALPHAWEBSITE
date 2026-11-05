import { useAuth } from '../../context/AuthContext';
import { hasModuleAccess } from '../../utils/moduleAccess';
import StudioSelect from '../components/common/StudioSelect';
import StudioButton from '../components/common/StudioButton';
import useReducedStudioMotion from '../components/operations/useReducedStudioMotion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion, useIsPresent } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Plus, Search, ArrowUpRight, Users, RefreshCw, CalendarDays, X, Trash2, Archive } from "lucide-react";
import toast from "react-hot-toast";
import { invoiceForLead, invoiceDestination } from "../components/operations/invoiceNavigation";
import StudioLeadForm from "../components/studio/StudioLeadForm";
import StudioLeadDetails from "../components/studio/StudioLeadDetails";
import { studioApi, studioAuth, LEAD_STATUSES, money, displayDate, initials, statusClass, leadStatusLabel, matchesLead, matchesLeadStage, mergeLead } from "../components/studio/leadUtils";
import "../studio-crm.css";
import { safeStudioReturn } from '../../utils/studioNavigation';
import { quotationStatus } from '../../utils/quotationStatus';
import { enquiryProjectId, enquiryQuoteId, enquiryProjectDestination, enquiryQuoteDestination } from '../../utils/enquiryWorkflow';

function EnquiryRowActions({ lead, onSelect, onDelete }) {
  const openButton = useRef(null);
  const archiveHadFocus = useRef(false);
  const linkedProject = Boolean(lead.studioProjectId);
  const actionLabel = linkedProject ? 'Archive enquiry' : 'Delete enquiry';
  useLayoutEffect(() => {
    if (lead.status === 'Archived' && archiveHadFocus.current) {
      archiveHadFocus.current = false;
      if (document.hasFocus() && document.activeElement === document.body) openButton.current?.focus({ preventScroll: true });
    }
  }, [lead.status]);
  return <div className="studio-crm-row-actions">
    <button ref={openButton} type="button" className="studio-icon-button" aria-label={`Open ${lead.name}`} onClick={event => { event.stopPropagation(); onSelect(lead); }}>
      <ArrowUpRight size={18} aria-hidden="true" /><span className="studio-phone-action-label">Open enquiry</span>
    </button>
    {!(linkedProject && lead.status === 'Archived') && <StudioButton
      type="button" variant="outline" size="sm"
      className="studio-crm-remove-enquiry"
      data-action={linkedProject ? 'archive' : 'delete'}
      aria-label={`${actionLabel} for ${lead.name}`}
      loadingLabel={`${linkedProject ? 'Archiving' : 'Deleting'} enquiry for ${lead.name}`}
      icon={linkedProject ? Archive : Trash2}
      onClick={event => { event.stopPropagation(); archiveHadFocus.current = linkedProject && document.activeElement === event.currentTarget; return onDelete(lead); }}
    >{actionLabel}</StudioButton>}
  </div>;
}

function EnquiryRow({ lead, onSelect, reducedMotion, children }) {
  const rowRef = useRef(null);
  const focusWithin = useRef(false);
  const isPresent = useIsPresent();
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (isPresent || !row || !focusWithin.current || !document.hasFocus()) return;
    if (document.activeElement !== document.body && !row.contains(document.activeElement)) return;
    const rows = [...row.parentElement.querySelectorAll('[data-enquiry-id]')];
    const index = rows.indexOf(row);
    const next = [...rows.slice(index + 1), ...rows.slice(0, index).reverse()].find(item => item.dataset.exiting !== 'true');
    const target = next?.querySelector('.studio-crm-row-actions button') || row.closest('.studio-enquiries-page')?.querySelector('input[aria-label="Search enquiries"]');
    target?.focus({ preventScroll: true });
  }, [isPresent]);
  return <Motion.tr ref={rowRef} role="row" data-enquiry-id={lead._id} data-exiting={!isPresent || undefined}
    layout={reducedMotion ? false : 'position'} initial={false} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: reducedMotion ? 0 : 10 }}
    transition={{ opacity: { duration: reducedMotion ? 0 : .16 }, x: { duration: reducedMotion ? 0 : .16 }, layout: { duration: reducedMotion ? 0 : .24, ease: [.16, 1, .3, 1] } }}
    inert={!isPresent || undefined} tabIndex={isPresent ? 0 : -1}
    onFocusCapture={() => { focusWithin.current = true; }}
    onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusWithin.current = false; }}
    onClick={() => { if (isPresent) onSelect(lead); }}
    onKeyDown={event => { if (isPresent && event.key === 'Enter' && event.target === event.currentTarget) onSelect(lead); }}
    className="studio-crm-clickable-row">{children}</Motion.tr>;
}

function ProjectCell({ lead }) {
  const { user } = useAuth();
  const id = lead.studioProjectId?._id || lead.studioProjectId;
  const name = lead.projectName || lead.eventType || "To be confirmed";
  return <><strong>{id && hasModuleAccess(user, 'projects') ? <Link className="studio-crm-text-link" to={`/admin/studio-projects/${id}`} onClick={event => event.stopPropagation()}>{name}</Link> : name}</strong><small>{lead.projectName && lead.eventType ? `${lead.eventType} · ` : ""}{displayDate(lead.eventDate, "Date to be confirmed")}</small></>;
}
function QuoteState({ lead }) {
  const { user } = useAuth();
  if (!hasModuleAccess(user, 'quotations')) return null;
  const id = lead.quotationId?._id || lead.quotationId;
  const quote = { ...(lead.quotationId && typeof lead.quotationId === 'object' ? lead.quotationId : {}), status: lead.quotationId?.status || lead.quotationStatus || 'Draft' };
  const knownValidity = quote.expiryEnabled === false || quote.validUntil || quote.expiresAt || !['Draft', 'Sent', 'Open'].includes(quote.status);
  return id ? <small><Link className="studio-crm-text-link" to={`/admin/quotations?quote=${encodeURIComponent(id)}`} title={lead.quotationNumber || "Open quotation"} onClick={event => event.stopPropagation()}>{knownValidity ? 'Quote ' + quotationStatus(quote).toLowerCase() : 'View quote'}</Link></small> : null;
}

export function EnquiriesView({ leads = [], loading = false, error = "", query = "", onQuery = () => {}, status = "All", onStatus = () => {}, sort = "newest", onSort = () => {}, onSelect = () => {}, onCreate = () => {}, onDelete = () => {}, onRefresh = () => {}, navigation = null }) {
  const { user } = useAuth();
  const reducedMotion = useReducedStudioMotion();
  const finance = hasModuleAccess(user, 'finance');
  const open = leads.filter((lead) => !["Converted", "Archived"].includes(lead.status));
  const converted = leads.filter((lead) => lead.status === "Converted");
  const attention = open.filter((lead) => lead.status === "New" || (lead.followUpDate && new Date(lead.followUpDate) < new Date()));
  const stages = ["All", ...(status === "Active" ? ["Active"] : []), ...LEAD_STATUSES];
  const countForStage = stage => stage === "All" ? leads.length : leads.filter(lead => matchesLeadStage(lead, stage)).length;
  const hasFilters = Boolean(query.trim()) || status !== "All";
  const clearFilters = () => { onQuery(""); onStatus("All"); };
  const filtered = leads.filter((lead) => matchesLeadStage(lead, status) && (matchesLead(lead, query) || [lead.projectName, lead.quotationNumber].some(value => String(value || "").toLowerCase().includes(query.toLowerCase())))).sort((a, b) => {
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    if (sort === "event") return (a.eventDate ? new Date(a.eventDate).getTime() : Infinity) - (b.eventDate ? new Date(b.eventDate).getTime() : Infinity);
    if (sort === "value") return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
    if (sort === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  return <div className="studio-enquiries-page">
    <div className="studio-page-heading"><div><h1>Enquiries</h1><p className="studio-muted">Follow up, prepare quotations and keep each client moving forward.</p></div><div className="studio-heading-actions">{hasModuleAccess(user, 'projects') && <Link className="studio-button" to="/admin/studio-projects">View projects <ArrowUpRight size={15} /></Link>}<button className="studio-button primary" onClick={onCreate}><Plus size={17} />New enquiry</button></div></div>
    {navigation}
    <section className="studio-card studio-crm-table-card" aria-label="Enquiry pipeline" aria-busy={loading}>
      <div className="studio-toolbar studio-crm-toolbar">
        <div className="studio-search studio-crm-search"><Search size={18} aria-hidden="true" /><input aria-label="Search enquiries" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search enquiries" autoComplete="off" />{query && <button type="button" className="studio-crm-clear-search" aria-label="Clear enquiry search" onClick={() => onQuery("")}><X size={16} aria-hidden="true" /></button>}</div>
        <div className="studio-phone-filter"><StudioSelect aria-label="Filter by enquiry stage" value={status} onChange={event => onStatus(event.target.value)}>{stages.map(stage => <option key={stage} value={stage}>{stage === "All" ? "All enquiries" : leadStatusLabel(stage)} · {countForStage(stage)}</option>)}</StudioSelect></div>
        <div className="studio-crm-toolbar-actions">
          <StudioSelect aria-label="Sort enquiries" className="studio-input studio-crm-sort" value={sort} onChange={(event) => onSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="event">Event date</option><option value="name">Client name</option>{finance && <option value="value">Project value</option>}</StudioSelect>
          <button type="button" className="studio-icon-button" aria-label={loading ? "Refreshing enquiries" : "Refresh enquiries"} title="Refresh enquiries" disabled={loading} onClick={onRefresh}><RefreshCw size={17} className={loading ? "studio-crm-spin" : undefined} /></button>
        </div>
      </div>
      <div className="studio-crm-stage-filters" role="group" aria-label="Filter by enquiry stage">{stages.map(stage => <button type="button" key={stage} aria-pressed={status === stage} onClick={() => onStatus(stage)} className={status === stage ? "active" : ""}>{stage === "All" ? "All enquiries" : leadStatusLabel(stage)}<span>{countForStage(stage)}</span></button>)}</div>
      {error ? <div className="studio-error studio-crm-load-error" role="alert"><p>{error}</p><button className="studio-button small" onClick={onRefresh}>Try again</button></div> : <div className="studio-crm-table-scroll"><table role="table" aria-label="Enquiries" className="studio-table studio-crm-table studio-phone-record-table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Client</th><th role="columnheader">Project & date</th><th role="columnheader">Stage</th>{finance && <th role="columnheader">Project value</th>}<th role="columnheader">Next follow-up</th><th role="columnheader"><span className="studio-crm-sr-only">Actions</span></th></tr></thead><tbody role="rowgroup">
        <AnimatePresence initial={false}>{loading ? <tr role="row" key="loading"><td role="cell" colSpan={finance ? 6 : 5}><div className="studio-empty"><RefreshCw size={25} className="studio-crm-spin" /><h3>Loading your enquiries…</h3><p>Bringing the latest conversations into view.</p></div></td></tr> : filtered.length ? filtered.map((lead) => <EnquiryRow key={lead._id} lead={lead} onSelect={onSelect} reducedMotion={reducedMotion}><td role="cell" data-label="Client"><div className="studio-crm-client"><span className="studio-crm-avatar">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>{lead.email}</small></div></div></td><td role="cell" data-label="Project & date"><ProjectCell lead={lead} /></td><td role="cell" data-label="Stage"><AnimatePresence initial={false} mode="wait"><Motion.span key={lead.status} className={`studio-badge studio-crm-badge ${statusClass(lead.status)}`} initial={{ opacity: reducedMotion ? 1 : .35 }} animate={{ opacity: 1 }} exit={{ opacity: reducedMotion ? 1 : .35 }} transition={{ duration: reducedMotion ? 0 : .1 }}>{leadStatusLabel(lead.status)}</Motion.span></AnimatePresence><QuoteState lead={lead} /></td>{finance && <td role="cell" data-label="Project value"><strong>{money(lead.totalAmount)}</strong><small>{lead.paymentStatus || "Unpaid"}</small></td>}<td role="cell" data-label="Follow-up"><span className={`studio-crm-followup-cell ${lead.followUpDate && new Date(lead.followUpDate) < new Date() ? "overdue" : ""}`}>{lead.followUpDate && <CalendarDays size={13} />}{displayDate(lead.followUpDate, "Not scheduled")}</span></td><td role="cell" data-label="Actions"><EnquiryRowActions lead={lead} onSelect={onSelect} onDelete={onDelete} /></td></EnquiryRow>) : <tr role="row" key="empty"><td role="cell" colSpan={finance ? 6 : 5}><div className="studio-empty"><Users size={28} /><h3>{leads.length ? "No matching enquiries" : "No enquiries yet"}</h3><p>{leads.length ? "Try a different search or clear your filters." : "Add your first enquiry and keep every detail in one place."}</p>{leads.length ? <button type="button" className="studio-button" onClick={clearFilters}>Clear filters</button> : <button type="button" className="studio-button primary" onClick={onCreate}><Plus size={16} />Add an enquiry</button>}</div></td></tr>}</AnimatePresence>
      </tbody></table></div>}
      {!loading && !error && <div className="studio-crm-table-footer"><span role="status">{hasFilters ? `${filtered.length} of ${leads.length}` : leads.length} {leads.length === 1 ? "enquiry" : "enquiries"}{status !== "All" && ` · ${leadStatusLabel(status)}`}</span>{hasFilters && <button type="button" className="studio-crm-text-link" onClick={clearFilters}>Clear filters</button>}</div>}
    </section>
    <details className="studio-details-section"><summary>Enquiry insights</summary>    <div className="studio-metric-grid studio-crm-metrics">
      <div className="studio-metric"><span>Open enquiries</span><strong>{loading ? "—" : open.length}</strong><small>Conversations in progress</small></div>
      <div className="studio-metric"><span>Needs attention</span><strong>{loading ? "—" : attention.length}</strong><small>New enquiries & overdue follow-ups</small></div>
      {hasModuleAccess(user, 'projects') && <div className="studio-metric"><span>Booked projects</span><strong>{loading ? "—" : converted.length}</strong><small>Accepted quotes and confirmed bookings</small></div>}
      {finance && <div className="studio-metric"><span>Pipeline value</span><strong>{loading ? "—" : money(open.reduce((sum, lead) => sum + (Number(lead.totalAmount) || 0), 0))}</strong><small>Across your open enquiries</small></div>}
    </div>
</details>
  </div>;
}

export default function CRM() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [workflowBusy, setWorkflowBusy] = useState('');
  const [workflowError, setWorkflowError] = useState('');
  const workflowInFlight = useRef(false);
  const requestedLeadId = searchParams.get('lead');
  const activeLead = requestedLeadId ? leads.find(lead => lead._id === requestedLeadId) || (selectedLead?._id === requestedLeadId ? selectedLead : null) : null;
  const returnTo = searchParams.get('returnTo');
  const [leadFormOpen, setShowLeadForm] = useState(false);
  const showLeadForm = leadFormOpen || searchParams.get("new") === "1";
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [previousUrlSearch, setPreviousUrlSearch] = useState(searchParams.get("search") || "");
  const urlSearch = searchParams.get("search") || "";
  if (previousUrlSearch !== urlSearch) { setPreviousUrlSearch(urlSearch); setSearchQuery(urlSearch); }
  const [filterStatus, setFilterStatus] = useState(() => ["Active", ...LEAD_STATUSES].includes(searchParams.get("stage")) ? searchParams.get("stage") : "All");
  const [sortBy, setSortBy] = useState("newest");
  const fetchLeads = () => axios.get(`${studioApi}/api/leads`, studioAuth())
    .then(({ data }) => { setLeads(Array.isArray(data) ? data : []); setError(""); })
    .catch(() => setError("We couldn’t load your enquiries. Please check your connection and try again."))
    .finally(() => setLoading(false));
  const invoicesAllowed = hasModuleAccess(user, 'invoices');
  const fetchInvoices = useCallback(() => invoicesAllowed ? axios.get(`${studioApi}/api/invoices`, studioAuth())
    .then(({ data }) => { setInvoices(Array.isArray(data) ? data : []); })
    .catch(() => {}) : Promise.resolve(), [invoicesAllowed]);
  useEffect(() => { fetchLeads(); fetchInvoices(); }, [fetchInvoices]);

  const updateLead = (next) => {
    setLeads((previous) => previous.map((lead) => lead._id === next._id ? mergeLead(lead, next) : lead));
    setSelectedLead((previous) => previous?._id === next._id ? mergeLead(previous, next) : previous);
  };
  const createLead = (lead) => {
    setLeads(previous => [lead, ...previous.filter(item => item._id !== lead._id)]);
    setSelectedLead(lead);
    setWorkflowError('');
    const next = new URLSearchParams(searchParams);
    next.delete('new'); next.set('lead', lead._id);
    setSearchParams(next, { replace: true });
  };
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
  const continueEnquiry = async (lead, action) => {
    if (workflowInFlight.current) return;
    setWorkflowError('');
    if (action === 'project' && enquiryProjectId(lead)) {
      navigate(enquiryProjectDestination(enquiryProjectId(lead))); return;
    }
    if (action === 'quote' && enquiryQuoteId(lead)) {
      navigate(enquiryQuoteDestination({ lead })); return;
    }
    workflowInFlight.current = true;
    setWorkflowBusy(action);
    try {
      const { data } = await axios.post(`${studioApi}/api/leads/${encodeURIComponent(lead._id)}/project`, {}, { ...studioAuth(), timeout: 30000 });
      updateLead(data.lead);
      navigate(action === 'quote' ? enquiryQuoteDestination(data) : enquiryProjectDestination(data.project));
    } catch (error) {
      setWorkflowError(error.response?.data?.error || error.response?.data?.msg || (error.code === 'ECONNABORTED'
        ? 'This request timed out. Retry to safely reopen the same project.'
        : 'The next step could not be opened. Please check your connection and retry.'));
    } finally { setWorkflowBusy(''); workflowInFlight.current = false; }
  };
  const selectLead = lead => {
    setSelectedLead(lead);
    setWorkflowError('');
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
    {activeLead && <StudioLeadDetails key={activeLead._id} lead={activeLead} onClose={closeLead} onUpdate={updateLead} onGenerateInvoice={hasModuleAccess(user, 'invoices') ? openInvoice : null} existingInvoice={invoiceForLead(invoices, activeLead)} onOpenProject={hasModuleAccess(user, 'projects') ? lead => continueEnquiry(lead, 'project') : null} onPrepareQuote={hasModuleAccess(user, 'quotations') && hasModuleAccess(user, 'projects') ? lead => continueEnquiry(lead, 'quote') : null} workflowBusy={workflowBusy} workflowError={workflowError} />}
  </div>;
}
