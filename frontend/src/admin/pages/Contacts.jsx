import WorkspaceMotionTitle from '../components/common/WorkspaceMotionTitle';
import { useWorkspaceModuleSearch } from '../components/common/WorkspaceModuleSearch';
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from '../../context/AuthContext';
import { canWriteWorkspaceModule } from '../../utils/workspaceActions';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../saas/release';
import { LayoutGrid, List, Pencil, Plus, Search, X } from "lucide-react";
import { ContactForm } from "../components/contacts/ContactWorkflowUI";
import { CompactContacts } from "../components/contacts/CompactWorkspaceRecords";
import {
  useWorkspaceData,
  recordDate,
} from "../components/operations/workspaceData";
import {
  WorkspaceError,
  WorkspaceEmpty,
} from "../components/operations/WorkspaceUI";
import "./referenceContacts.css";
import "./projectContactRefinement.css";
import ContactDirectory from './ContactDirectory';
import StudioSelect from "../components/common/StudioSelect";
import RecordViewSwitch from './RecordViewSwitch';
import './studioRecordDesk.css';

const contactFilters = [
  { id: "All Contacts", label: "All contacts" },
  { id: "Clients", label: "Clients", type: "Client" },
  { id: "Leads", label: "Leads", type: "Lead" },
  { id: "Other", label: "Other", type: "Other" },
];

export default function Contacts() {
  const { user } = useAuth();
  const canEdit = !IS_COMMERCIAL_DEPLOYMENT || canWriteWorkspaceModule(user, 'contacts');
  const { data, loading, error, reload } = useWorkspaceData(["/api/contacts"]),
    [contacts = []] = data;
  const [tab, setTab] = useState("All Contacts"),
    [view, setView] = useState(IS_COMMERCIAL_DEPLOYMENT ? 'people' : 'list'),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(undefined),
    navigate = useNavigate();
  const useTopbarSearch = useWorkspaceModuleSearch({ label: 'Search contacts', query, onChange: setQuery });
  const [params, setParams] = useSearchParams();
  const createRequested = IS_COMMERCIAL_DEPLOYMENT && canEdit && params.get('new') === '1';
  const formRecord = createRequested ? null : editing;
  const clearCreate = () => {
    if (!createRequested) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  };
  const selectedType = contactFilters.find(filter => filter.id === tab)?.type;
  const filters = contactFilters.map(filter => ({
    ...filter,
    count: filter.type ? contacts.filter(contact => contact.contactType === filter.type).length : contacts.length,
  }));
  const clientCount = filters.find(filter => filter.type === "Client").count;
  const visible = contacts.filter(
    (contact) =>
      (!selectedType || contact.contactType === selectedType) &&
      [
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone,
        contact.company,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const mobileTypeFilter = <div className="record-contact-type-picker">
    <StudioSelect aria-label="Filter contacts by type" value={tab} onChange={event => setTab(event.target.value)}>
      {filters.map(filter => <option key={filter.id} value={filter.id}>{filter.label} ({filter.count})</option>)}
    </StudioSelect>
  </div>;
  const resultCount = <p className="project-contact-result-count" data-filtered={Boolean(loading || query || selectedType)} role="status">{loading ? "Loading contacts…" : `${visible.length} of ${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`}</p>;
  return (
    <div data-topbar-search={useTopbarSearch || undefined} className={'reference-workspace project-contact-workspace project-contact-register' + (IS_COMMERCIAL_DEPLOYMENT ? ' record-desk record-contact-directory' : '')}>
      <div className="reference-heading project-contact-heading">
        <div className="project-contact-heading-copy"><WorkspaceMotionTitle>Contacts</WorkspaceMotionTitle><p>{IS_COMMERCIAL_DEPLOYMENT && !loading && !error ? `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} · ${clientCount} ${clientCount === 1 ? 'client' : 'clients'}` : 'Find a client, open their projects or update their details.'}</p></div>
        {canEdit && <div className="project-contact-heading-actions"><button className="reference-button" onClick={() => setEditing(null)}><Plus size={17} aria-hidden="true" />New contact</button></div>}
      </div>
      {IS_COMMERCIAL_DEPLOYMENT && <div className="record-contact-views">
        <RecordViewSwitch value={view} onChange={setView} label="Contact view"
        views={[{ id: 'people', label: 'People', icon: LayoutGrid }, { id: 'list', label: 'List', icon: List }]}
        surfaceSelector=".record-people,.reference-mobile-records,.reference-desktop-records" />
        {!useTopbarSearch && mobileTypeFilter}
      </div>}
      {!useTopbarSearch && <div className="project-contact-register-tools">
        <label className="reference-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or contact info"
            aria-label="Search contacts"
          />
        </label>
        {query && <button type="button" className="reference-icon-button" aria-label="Clear contact search" onClick={() => setQuery("")}><X size={17} aria-hidden="true" /></button>}
        {resultCount}
      </div>}
      <div className="record-register-summary">
        {useTopbarSearch && mobileTypeFilter}
        <div className="reference-tabs project-contact-filters" role="group" aria-label="Filter contacts by type">
          {filters.map(filter => (
            <button key={filter.id} className={tab === filter.id ? "active" : ""} aria-pressed={tab === filter.id} onClick={() => setTab(filter.id)}>
              <span>{filter.label}</span><span className="project-contact-filter-count">{filter.count}</span>
            </button>
          ))}
        </div>
        {useTopbarSearch && resultCount}
      </div>
      <WorkspaceError error={error} retry={reload} />
      {visible.length && view === 'people' ? <ContactDirectory contacts={visible} onEdit={canEdit ? setEditing : undefined} /> : visible.length ? (
        <>
        <CompactContacts contacts={visible} onEdit={canEdit ? setEditing : undefined} />
        <div className="reference-table-scroll reference-desktop-records">
          <table className="reference-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Created</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contact) => (
                <tr key={contact._id}>
                  <td>
                    <Link
                      className="reference-name-link"
                      to={`/admin/contacts/${contact._id}`}
                    >
                      <span className="reference-avatar small">
                        {`${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase()}
                      </span>
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`reference-status ${contact.contactType.toLowerCase()}`}
                    >
                      {contact.contactType}
                    </span>
                  </td>
                  <td>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </td>
                  <td>{contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</td>
                  <td>{recordDate(contact.createdAt)}</td>
                  <td>
                    {canEdit && <button
                      className="reference-icon-button"
                      aria-label={`Edit ${contact.firstName} ${contact.lastName || ""}`}
                      title="Edit contact"
                      onClick={() => setEditing(contact)}
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <WorkspaceEmpty
          loading={loading}
          title={query ? "No matching contacts" : tab !== "All Contacts" ? `No ${tab.toLowerCase()} here yet` : "No contacts yet"}
          description={
            query
              ? "Try another name, email, or phone number."
              : !canEdit ? "Contacts available to you appear here. You can also try another contact type." : tab !== "All Contacts" ? "Choose another contact type or add a new contact." : "Add a contact to start a project, prepare documents, and keep their details together."
          }
        >
          {(query || tab !== "All Contacts") && <button type="button" className="studio-button" onClick={() => { setQuery(""); setTab("All Contacts"); }}>View all contacts</button>}
        </WorkspaceEmpty>
      )}
      {canEdit && formRecord !== undefined && (
        <ContactForm
          key={formRecord?._id || 'new-contact'}
          record={formRecord}
          onClose={() => { setEditing(undefined); clearCreate(); }}
          onSaved={(contact) => {
            setEditing(undefined);
            reload();
            if (!formRecord) navigate(`/admin/contacts/${contact._id}`, { replace: createRequested });
          }}
        />
      )}
    </div>
  );
}
