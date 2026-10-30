import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import {
  useWorkspaceData,
  workspaceRequest,
  recordDate,
  recordError,
} from "../components/operations/workspaceData";
import {
  WorkspaceError,
  WorkspaceEmpty,
} from "../components/operations/WorkspaceUI";
import {
  ContactForm,
  ProjectForm,
  ContactCreateMenu,
  ContactDocumentForm,
  ContactNote,
  ReferenceSection,
} from "../components/contacts/ContactWorkflowUI";
import {
  ContactDocuments,
  ContactPayments,
  ContactPaymentSummary,
  ContactSessions,
  ContactConversations,
} from "../components/contacts/ContactRelatedTables";
import "./referenceContacts.css";
import { WorkspaceActionMenu } from "../components/operations/WorkspaceActionMenu";
export default function ContactDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/contacts/" + id,
      "/api/contacts",
    ]),
    [detail, contacts = []] = data;
  const [tab, setTab] = useState("Overview"),
    [editing, setEditing] = useState(false),
    [newProject, setNewProject] = useState(false),
    [document, setDocument] = useState(null),
    [busy, setBusy] = useState(false);
  if (!detail || String(detail.contact?._id) !== id)
    return (
      <div className="reference-workspace">
        <Link to="/admin/contacts" className="reference-back">
          <ArrowLeft size={17} />
          Contacts
        </Link>
        <WorkspaceError error={error} retry={reload} />
        <WorkspaceEmpty
          loading={loading || (!!detail && !error)}
          title="Contact unavailable"
          description="Choose another contact or try loading this one again."
        />
      </div>
    );
  const {
    contact,
    projects = [],
    quotations = [],
    invoices = [],
    sessions = [],
    documents = [],
  } = detail;
  const name = `${contact.firstName} ${contact.lastName || ""}`.trim(),
    address = [
      contact.addressLine1,
      contact.addressLine2,
      [contact.city, contact.state, contact.postalCode]
        .filter(Boolean)
        .join(", "),
      contact.country,
    ].filter(Boolean);
  const openDocument = (typeOrRecord) =>
    setDocument(
      typeof typeOrRecord === "string"
        ? { type: typeOrRecord }
        : { type: typeOrRecord.type, record: typeOrRecord },
    );
  const changeType = async (contactType) => {
    setBusy(true);
    try {
      await workspaceRequest("patch", "/api/contacts/" + id, { contactType });
      reload();
    } catch (err) {
      toast.error(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    const archived = !contact.archived;
    if (
      !window.confirm(
        `${archived ? "Archive" : "Restore"} ${name}? Their documents and projects will be kept.`,
      )
    )
      return;
    try {
      await workspaceRequest("patch", "/api/contacts/" + id, { archived });
      toast.success(archived ? "Contact archived" : "Contact restored");
      if (archived) navigate("/admin/contacts");
      else reload();
    } catch (err) {
      toast.error(recordError(err));
    }
  };
  return (
    <div className="reference-workspace">
      <div className="reference-heading">
        <Link
          to="/admin/contacts"
          className="reference-back"
          aria-label="Back to contacts"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1>{name}</h1>
        <select
          className={`reference-status-select ${contact.contactType.toLowerCase()}`}
          aria-label="Contact type"
          disabled={busy}
          value={contact.contactType}
          onChange={(event) => changeType(event.target.value)}
        >
          {["Client", "Lead", "Other"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
        <div className="reference-heading-spacer" />
        <WorkspaceActionMenu label="More">
            <button onClick={() => setEditing(true)}>Edit contact</button>
            <button onClick={archive}>
              {contact.archived ? "Restore contact" : "Archive contact"}
            </button>
        </WorkspaceActionMenu>
        {contact.archived ? (
          <span className="reference-status neutral">Archived</span>
        ) : (
          <ContactCreateMenu
            contact={contact}
            onProject={() => setNewProject(true)}
            onDocument={openDocument}
          />
        )}
      </div>
      <WorkspaceError error={error} retry={reload} />
      <div className="reference-detail-grid">
        <main>
          <div className="reference-tabs">
            {["Overview", "Documents", "Payments", "Sessions"].map((label) => (
              <button
                className={label === tab ? "active" : ""}
                key={label}
                onClick={() => setTab(label)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <>
              <ReferenceSection
                title="Projects"
                action={() => setNewProject(true)}
              >
                {projects.length ? (
                  <div className="reference-list">
                    {projects.map((project) => (
                      <Link
                        key={project._id}
                        to={`/admin/studio-projects/${project._id}`}
                        className="reference-list-row"
                      >
                        <span>
                          <strong>{project.name}</strong>
                          <small>
                            {project.type} ·{" "}
                            {project.startDate
                              ? recordDate(project.startDate)
                              : "Date TBD"}
                          </small>
                        </span>
                        <span
                          className={`reference-status ${project.status.toLowerCase()}`}
                        >
                          {project.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="reference-empty">
                    No projects from this contact yet.
                  </p>
                )}
              </ReferenceSection>
              <ReferenceSection
                title="Recent Conversations"
                action={() => openDocument("Message")}
              >
                <ContactConversations
                  documents={documents}
                  onDraft={openDocument}
                />
              </ReferenceSection>

            </>
          )}
          {tab === "Documents" && (
            <ReferenceSection title="Documents">
              <ContactDocuments
                quotations={quotations}
                invoices={invoices}
                documents={documents}
                onDraft={openDocument}
              />
            </ReferenceSection>
          )}
          {tab === "Payments" && (
            <ReferenceSection title="Payments">
              <ContactPaymentSummary invoices={invoices} />
              <ContactPayments invoices={invoices} />
            </ReferenceSection>
          )}
          {tab === "Sessions" && (
            <ReferenceSection
              title="Sessions"
              action={() => navigate(`/admin/calendar?contact=${id}`)}
            >
              <ContactSessions sessions={sessions} />
            </ReferenceSection>
          )}
        </main>
        <aside>
          <ReferenceSection title="Contact Info">
            <button
              className="reference-info-edit reference-icon-button"
              aria-label="Edit contact info"
              onClick={() => setEditing(true)}
            >
              <Pencil size={17} />
            </button>
            <div className="reference-contact-identity">
              <span className="reference-avatar">
                {contact.firstName[0]}
                {contact.lastName?.[0]}
              </span>
              <div>
                <strong>{name}</strong>
                <small>{contact.email}</small>
              </div>
            </div>
            <dl className="reference-details">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Company</dt>
              <dd>{contact.company || "—"}</dd>
              <dt>Address</dt>
              <dd>
                {address.length
                  ? address.map((line, index) => (
                      <span className="reference-address-line" key={index}>
                        {line}
                      </span>
                    ))
                  : "—"}
              </dd>
              <dt>Note</dt>
              <dd>
                <ContactNote
                  note={contact.note}
                  onSave={async (note) => {
                    await workspaceRequest("patch", "/api/contacts/" + id, {
                      note,
                    });
                    await reload();
                  }}
                />
              </dd>
            </dl>
          </ReferenceSection>
        </aside>
      </div>
      {editing && (
        <ContactForm
          record={contact}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {newProject && (
        <ProjectForm
          contact={contact}
          contacts={contacts}
          onClose={() => setNewProject(false)}
          onSaved={(project) =>
            navigate(`/admin/studio-projects/${project._id}`)
          }
        />
      )}
      {document && (
        <ContactDocumentForm
          {...document}
          contact={contact}
          onClose={() => setDocument(null)}
          onSaved={() => {
            setDocument(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
