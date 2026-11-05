import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Plus, Search, X } from "lucide-react";
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
export default function Contacts() {
  const { data, loading, error, reload } = useWorkspaceData(["/api/contacts"]),
    [contacts = []] = data;
  const [tab, setTab] = useState("All Contacts"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(undefined),
    navigate = useNavigate();
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
    <div className="reference-workspace project-contact-workspace project-contact-register">
      <div className="reference-heading project-contact-heading">
        <div className="project-contact-heading-copy"><h1>Contacts</h1><p>Find a client, open their projects or update their details.</p></div>
        <div className="project-contact-heading-actions"><button className="reference-button" onClick={() => setEditing(null)}><Plus size={17} aria-hidden="true" />New contact</button></div>
      </div>
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
      {visible.length ? (
        <>
        <CompactContacts contacts={visible} onEdit={setEditing} />
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
                    <button
                      className="reference-icon-button"
                      aria-label={`Edit ${contact.firstName} ${contact.lastName || ""}`}
                      title="Edit contact"
                      onClick={() => setEditing(contact)}
                    >
                      <Pencil size={17} aria-hidden="true" />
                    </button>
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
              : tab !== "All Contacts" ? "Choose another contact type or add a new contact." : "Add a contact to start a project, prepare documents, and keep their details together."
          }
        >
          {(query || tab !== "All Contacts") && <button type="button" className="studio-button" onClick={() => { setQuery(""); setTab("All Contacts"); }}>View all contacts</button>}
        </WorkspaceEmpty>
      )}
      {editing !== undefined && (
        <ContactForm
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(contact) => {
            setEditing(undefined);
            reload();
            if (!editing) navigate(`/admin/contacts/${contact._id}`);
          }}
        />
      )}
    </div>
  );
}
