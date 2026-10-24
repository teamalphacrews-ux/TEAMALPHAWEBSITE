import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Mail,
  Pencil,
  ReceiptText,
} from "lucide-react";
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
  ProjectForm,
  ContactCreateMenu,
  ContactDocumentForm,
  ReferenceSection,
} from "../components/contacts/ContactWorkflowUI";
import {
  ContactDocuments,
  ContactPaymentSummary,
  ContactSessions,
  ContactConversations,
} from "../components/contacts/ContactRelatedTables";
import "./referenceContacts.css";
import { WorkspaceActionMenu } from "../components/operations/WorkspaceActionMenu";
export default function StudioProjectDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, loading, error, reload } = useWorkspaceData([
      "/api/studio-projects/" + id,
      "/api/contacts",
    ]),
    [detail, contacts = []] = data;
  const [editing, setEditing] = useState(false),
    [document, setDocument] = useState(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [noteError, setNoteError] = useState("");
  if (!detail?.project || String(detail.project._id) !== id)
    return (
      <div className="reference-workspace">
        <Link to="/admin/studio-projects" className="reference-back">
          <ArrowLeft size={17} />
          Projects
        </Link>
        <WorkspaceError error={error} retry={reload} />
        <WorkspaceEmpty
          loading={loading || (!!detail && !error)}
          title="Project unavailable"
          description="Choose another project or try loading again."
        />
      </div>
    );
  const {
      project,
      quotations = [],
      invoices = [],
      sessions = [],
      documents = [],
    } = detail,
    contact = project.contactId;
  if (!contact)
    return (
      <WorkspaceError
        error="The primary client could not be found for this project."
        retry={reload}
      />
    );
  const query = new URLSearchParams({
      contact: contact._id,
      project: id,
    }).toString(),
    hasDocuments =
      quotations.length +
        invoices.length +
        documents.filter((item) => item.type !== "Message").length >
      0;
  const openDocument = (typeOrRecord) =>
    setDocument(
      typeof typeOrRecord === "string"
        ? { type: typeOrRecord }
        : { type: typeOrRecord.type, record: typeOrRecord },
    );
  const setStatus = async (status) => {
    setBusy(true);
    try {
      await workspaceRequest("patch", "/api/studio-projects/" + id, { status });
      reload();
    } catch (err) {
      toast.error(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const addNote = async (event) => {
    event.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    setNoteError("");
    try {
      await workspaceRequest("post", `/api/studio-projects/${id}/notes`, {
        body: note,
      });
      setNote("");
      reload();
    } catch (err) {
      setNoteError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const actions = [
    {
      label: "Invoice",
      description: "Get paid for your services.",
      icon: ReceiptText,
      action: () => navigate("/admin/invoices/new?" + query),
    },
    {
      label: "Contract",
      description: "Prepare your client contract.",
      icon: FileSignature,
      action: () => openDocument("Contract"),
    },
    {
      label: "Questionnaire",
      description: "Learn about your client needs.",
      icon: ClipboardList,
      action: () => openDocument("Questionnaire"),
    },
    {
      label: "Quote",
      description: "Get your client acceptance before sending an invoice.",
      icon: FileText,
      action: () => navigate("/admin/quotations?" + query),
    },
  ];
  return (
    <div className="reference-workspace">
      <div className="reference-heading">
        <Link
          to={`/admin/contacts/${contact._id}`}
          className="reference-back"
          aria-label="Back to client"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1>{project.name}</h1>
        <select
          aria-label="Project status"
          className={`reference-status-select ${project.status.toLowerCase()}`}
          value={project.status}
          disabled={busy}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["Inquiry", "Booked", "Completed", "Archived"].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <div className="reference-heading-spacer" />
        <WorkspaceActionMenu label="More">
            <button onClick={() => setEditing(true)}>Edit project</button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Archive this project? Documents and notes will be kept.",
                  )
                )
                  setStatus("Archived");
              }}
            >
              Archive project
            </button>
        </WorkspaceActionMenu>
        <ContactCreateMenu
          contact={contact}
          projectId={id}
          onDocument={openDocument}
        />
      </div>
      <WorkspaceError error={error} retry={reload} />
      <div className="reference-detail-grid project">
        <main>
          <ReferenceSection title={hasDocuments ? "Documents" : "Get Started"}>
            {hasDocuments && (
              <ContactDocuments
                quotations={quotations}
                invoices={invoices}
                documents={documents}
                onDraft={openDocument}
              />
            )}
            <p className="reference-group-label">Send documents</p>
            <div className="reference-action-list">
              {actions.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.label} onClick={option.action}>
                    <span className="reference-action-icon">
                      <Icon size={27} strokeWidth={1.2} />
                    </span>
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="reference-group-label">Schedule sessions</p>
            <div className="reference-action-list">
              <button onClick={() => navigate("/admin/calendar?" + query)}>
                <span className="reference-action-icon">
                  <CalendarDays size={27} strokeWidth={1.2} />
                </span>
                <span>
                  <strong>Session</strong>
                  <small>Schedule a session with your client.</small>
                </span>
              </button>
            </div>
            {sessions.length > 0 && <ContactSessions sessions={sessions} />}
            <p className="reference-group-label">Conversations</p>
            <div className="reference-action-list">
              <button onClick={() => openDocument("Message")}>
                <span className="reference-action-icon">
                  <Mail size={27} strokeWidth={1.2} />
                </span>
                <span>
                  <strong>Conversations</strong>
                  <small>Write a new message draft to your client.</small>
                </span>
              </button>
            </div>
            {documents.some((item) => item.type === "Message") && (
              <ContactConversations
                documents={documents}
                onDraft={openDocument}
              />
            )}
          </ReferenceSection>
          <ReferenceSection title="Payments">
            <ContactPaymentSummary invoices={invoices} />
          </ReferenceSection>

        </main>
        <aside>
          <ReferenceSection title="Project Details">
            <button
              className="reference-info-edit reference-icon-button"
              aria-label="Edit project details"
              onClick={() => setEditing(true)}
            >
              <Pencil size={17} />
            </button>
            <dl className="reference-details">
              <dt>Primary Client</dt>
              <dd>
                <Link
                  to={`/admin/contacts/${contact._id}`}
                  className="reference-green-link"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
                <span className="reference-address-line">{contact.email}</span>
                <span className="reference-address-line">{contact.phone}</span>
              </dd>
              <dt>Additional Clients</dt>
              <dd>
                {project.additionalClients?.length
                  ? project.additionalClients.map((client) => (
                      <Link
                        className="reference-green-link reference-address-line"
                        key={client._id}
                        to={`/admin/contacts/${client._id}`}
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                    ))
                  : "—"}
              </dd>
              <dt>Project Type</dt>
              <dd>{project.type}</dd>
              <dt>Project Date</dt>
              <dd>
                {project.startDate ? recordDate(project.startDate) : "TBD"}
                {project.endDate && " — " + recordDate(project.endDate)}
              </dd>
              <dt>Location</dt>
              <dd>{project.location || "—"}</dd>
              <dt>Description</dt>
              <dd className="reference-note-text">
                {project.description || "—"}
              </dd>
            </dl>
          </ReferenceSection>
          <ReferenceSection title="Notes">
            <form onSubmit={addNote}>
              <textarea
                className="reference-project-note"
                aria-label="New project note"
                placeholder="Write a note (only visible to your studio)"
                value={note}
                maxLength={5000}
                onChange={(event) => setNote(event.target.value)}
              />
              <WorkspaceError error={noteError} />
              <button
                className="reference-button small"
                disabled={!note.trim() || busy}
              >
                {busy ? "Saving…" : "Add note"}
              </button>
            </form>
            <div className="reference-project-notes">
              {[...(project.notes || [])].reverse().map((item, index) => (
                <div key={item._id || index}>
                  <p>{item.body}</p>
                  <small>{recordDate(item.createdAt)}</small>
                </div>
              ))}
            </div>
          </ReferenceSection>
        </aside>
      </div>
      {editing && (
        <ProjectForm
          project={project}
          contact={contact}
          contacts={contacts}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
      {document && (
        <ContactDocumentForm
          {...document}
          contact={contact}
          projectId={id}
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
