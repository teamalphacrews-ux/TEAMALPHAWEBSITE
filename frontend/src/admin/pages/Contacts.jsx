import WorkspaceMotionTitle from '../components/common/WorkspaceMotionTitle';
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
import RecordViewSwitch from './RecordViewSwitch';
import './studioRecordDesk.css';

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
  const [params, setParams] = useSearchParams();
  const createRequested = IS_COMMERCIAL_DEPLOYMENT && canEdit && params.get('new') === '1';
  const formRecord = createRequested ? null : editing;
  const clearCreate = () => {
    if (!createRequested) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  };
  const visible = contacts.filter(
    (contact) =>
      (tab === "All Contacts" ||
        contact.contactType ===
          { Clients: "Client", Leads: "Lead", Other: "Other" }[tab]) &&
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
  return (
    <div className={'reference-workspace project-contact-workspace project-contact-register' + (IS_COMMERCIAL_DEPLOYMENT ? ' record-desk' : '')}>
      <div className="reference-heading project-contact-heading">
        <div className="project-contact-heading-copy"><WorkspaceMotionTitle>Contacts</WorkspaceMotionTitle><p>{IS_COMMERCIAL_DEPLOYMENT && !loading && !error ? `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} · ${contacts.filter(contact => contact.contactType === 'Client').length} clients` : 'Find a client, open their projects or update their details.'}</p></div>
        {canEdit && <div className="project-contact-heading-actions"><button className="reference-button" onClick={() => setEditing(null)}><Plus size={17} aria-hidden="true" />New contact</button></div>}
      </div>
      {IS_COMMERCIAL_DEPLOYMENT && <RecordViewSwitch value={view} onChange={setView} label="Contact view"
        views={[{ id: 'people', label: 'People', icon: LayoutGrid }, { id: 'list', label: 'List', icon: List }]}
        surfaceSelector=".record-people,.reference-mobile-records,.reference-desktop-records" />}
      <div className="project-contact-register-tools">
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
        <p className="project-contact-result-count" role="status">{loading ? "Loading contacts…" : `${visible.length} of ${contacts.length} contacts`}</p>
      </div>
      <div className="reference-tabs project-contact-filters" aria-label="Filter contacts by type">
        {["All Contacts", "Clients", "Leads", "Other"].map((label) => (
          <button
            key={label}
            className={tab === label ? "active" : ""}
            aria-pressed={tab === label}
            onClick={() => setTab(label)}
          >
            <span>{label === "All Contacts" ? "All contacts" : label}</span><span className="project-contact-filter-count">{label === "All Contacts" ? contacts.length : contacts.filter(contact => contact.contactType === { Clients: "Client", Leads: "Lead", Other: "Other" }[label]).length}</span>
          </button>
        ))}
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
