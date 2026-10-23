import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, MoreHorizontal } from "lucide-react";
import { ContactForm } from "../components/contacts/ContactWorkflowUI";
import {
  useWorkspaceData,
  recordDate,
} from "../components/operations/workspaceData";
import {
  WorkspaceError,
  WorkspaceEmpty,
} from "../components/operations/WorkspaceUI";
import "./referenceContacts.css";
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
    <div className="reference-workspace">
      <div className="reference-heading">
        <h1>Contacts</h1>
        <label className="reference-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or contact info"
            aria-label="Search contacts"
          />
        </label>
        <button className="reference-button" onClick={() => setEditing(null)}>
          New Contact
        </button>
      </div>
      <div className="reference-tabs">
        {["All Contacts", "Clients", "Leads", "Other"].map((label) => (
          <button
            key={label}
            className={tab === label ? "active" : ""}
            onClick={() => setTab(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <WorkspaceError error={error} retry={reload} />
      {visible.length ? (
        <div className="reference-table-scroll">
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
                  <td>{contact.phone || "—"}</td>
                  <td>{recordDate(contact.createdAt)}</td>
                  <td>
                    <button
                      className="reference-icon-button"
                      aria-label={`Edit ${contact.firstName} ${contact.lastName || ""}`}
                      onClick={() => setEditing(contact)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <WorkspaceEmpty
          loading={loading}
          title={query ? "No matching contacts" : "No contacts yet"}
          description={
            query
              ? "Try another name, email, or phone number."
              : "Add a contact to start a project, prepare documents, and keep their details together."
          }
        />
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
