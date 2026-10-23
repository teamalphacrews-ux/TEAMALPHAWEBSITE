import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileSignature,
  FileText,
  Folder,
  Mail,
  Plus,
  ReceiptText,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  WorkspaceDialog,
  WorkspaceField,
  WorkspaceError,
} from "../operations/WorkspaceUI";
import { workspaceRequest, recordError } from "../operations/workspaceData";
import "../../pages/referenceContacts.css";
import { contactCountries } from "./countries";

export function ContactForm({ record, onClose, onSaved }) {
  const [form, setForm] = useState({
    contactType: "Client",
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    note: "",
    ...record,
  });
  const [additional, setAdditional] = useState(!!record?.addressLine1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await workspaceRequest(
        record ? "patch" : "post",
        "/api/contacts" + (record ? "/" + record._id : ""),
        form,
      );
      toast.success(record ? "Contact updated" : "Contact added");
      onSaved(value);
    } catch (err) {
      setError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="reference-contact-modal">
      <WorkspaceDialog
        title={record ? "Edit contact" : "Add contact"}
        onClose={onClose}
        onSubmit={save}
        busy={busy}
        error={error}
        submitLabel={record ? "Save contact" : "Add contact"}
      >
        <WorkspaceField
          label="Contact type"
          name="contactType"
          value={form.contactType}
          onChange={change}
          options={["Client", "Lead", "Other"]}
          wide
        />
        <WorkspaceField
          label="First name"
          name="firstName"
          value={form.firstName}
          onChange={change}
          required
        />
        <WorkspaceField
          label="Last name"
          name="lastName"
          value={form.lastName}
          onChange={change}
        />
        <WorkspaceField
          label="Company"
          name="company"
          value={form.company}
          onChange={change}
          wide
        />
        <WorkspaceField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={change}
          required
          wide
        />
        <WorkspaceField
          label="Phone"
          name="phone"
          value={form.phone}
          onChange={change}
          type="tel"
          wide
        />
        <button
          type="button"
          className="reference-text-button workspace-wide"
          onClick={() => setAdditional(!additional)}
          aria-expanded={additional}
        >
          Additional info <ChevronDown size={13} />
        </button>
        {additional && (
          <>
            <WorkspaceField
              label="Address line 1"
              name="addressLine1"
              value={form.addressLine1}
              onChange={change}
              wide
            />
            <WorkspaceField
              label="Address line 2"
              name="addressLine2"
              value={form.addressLine2}
              onChange={change}
              wide
            />
            {[
              ["city", "City"],
              ["state", "State / Province"],
              ["postalCode", "ZIP / Postal code"],
            ].map(([name, label]) => (
              <WorkspaceField
                key={name}
                label={label}
                name={name}
                value={form[name]}
                onChange={change}
              />
            ))}
            <WorkspaceField
              label="Country"
              name="country"
              value={form.country}
              onChange={change}
              options={[
                { value: "", label: "Please select a country" },
                ...contactCountries,
                ...(form.country && !contactCountries.includes(form.country)
                  ? [form.country]
                  : []),
              ]}
            />
            <WorkspaceField
              label="Note"
              name="note"
              value={form.note}
              onChange={change}
              type="textarea"
              wide
            />
          </>
        )}
      </WorkspaceDialog>
    </div>
  );
}
export function ProjectForm({
  contact,
  project,
  contacts = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    contactId: contact?._id || "",
    name: contact ? `${contact.firstName}'s Project` : "",
    type: "Wedding",
    status: "Inquiry",
    startDate: "",
    endDate: "",
    location: "",
    description: "",
    additionalClients: [],
    ...project,
    ...(project
      ? {
          contactId: project.contactId?._id || project.contactId,
          startDate: project.startDate?.slice(0, 10) || "",
          endDate: project.endDate?.slice(0, 10) || "",
          additionalClients: (project.additionalClients || []).map(
            (item) => item._id || item,
          ),
        }
      : {}),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (name, value) =>
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "contactId"
        ? {
            additionalClients: current.additionalClients.filter(
              (id) => id !== value,
            ),
          }
        : {}),
    }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await workspaceRequest(
        project ? "patch" : "post",
        "/api/studio-projects" + (project ? "/" + project._id : ""),
        form,
      );
      toast.success(project ? "Project updated" : "Project created");
      onSaved(value);
    } catch (err) {
      setError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkspaceDialog
      title={project ? "Edit project details" : "Create a new project"}
      onClose={onClose}
      onSubmit={save}
      busy={busy}
      error={error}
      submitLabel={project ? "Save project" : "Create project"}
    >
      <WorkspaceField
        label="Primary client"
        name="contactId"
        value={form.contactId}
        onChange={change}
        options={[
          { value: "", label: "Choose a client" },
          ...contacts.map((item) => ({
            value: item._id,
            label: `${item.firstName} ${item.lastName || ""}`,
          })),
          ...(!contacts.some((item) => item._id === contact?._id) && contact
            ? [
                {
                  value: contact._id,
                  label: `${contact.firstName} ${contact.lastName || ""}`,
                },
              ]
            : []),
        ]}
        required
        wide
      />
      <WorkspaceField
        label="Project name"
        name="name"
        value={form.name}
        onChange={change}
        required
        wide
      />
      <WorkspaceField
        label="Project type"
        name="type"
        value={form.type}
        onChange={change}
        options={[
          "Wedding",
          "Engagement",
          "Pre-Wedding",
          "Family",
          "Maternity",
          "Newborn",
          "Portrait",
          "Commercial",
          "Other",
        ]}
      />
      <WorkspaceField
        label="Status"
        name="status"
        value={form.status}
        onChange={change}
        options={["Inquiry", "Booked", "Completed", "Archived"]}
      />
      <WorkspaceField
        label="Project date"
        name="startDate"
        value={form.startDate}
        onChange={change}
        type="date"
      />
      <WorkspaceField
        label="End date"
        name="endDate"
        value={form.endDate}
        onChange={change}
        type="date"
      />
      <WorkspaceField
        label="Location"
        name="location"
        value={form.location}
        onChange={change}
        wide
      />
      <WorkspaceField
        label="Description"
        name="description"
        value={form.description}
        onChange={change}
        type="textarea"
        wide
      />
      {contacts.length > 1 && (
        <fieldset className="reference-additional-clients workspace-wide">
          <legend>Additional clients</legend>
          {contacts
            .filter((item) => item._id !== form.contactId)
            .map((item) => (
              <label key={item._id}>
                <input
                  type="checkbox"
                  checked={form.additionalClients.includes(item._id)}
                  onChange={(event) =>
                    change(
                      "additionalClients",
                      event.target.checked
                        ? [...form.additionalClients, item._id]
                        : form.additionalClients.filter(
                            (id) => id !== item._id,
                          ),
                    )
                  }
                />
                {item.firstName} {item.lastName}
              </label>
            ))}
        </fieldset>
      )}
    </WorkspaceDialog>
  );
}
export function ContactDocumentForm({
  type,
  contact,
  projectId,
  record,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
      title: record?.title || `${type} for ${contact.firstName}`,
      content: record?.content || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await workspaceRequest(
        record ? "patch" : "post",
        "/api/contact-documents" + (record ? "/" + record._id : ""),
        {
          ...form,
          type,
          contactId: contact._id,
          studioProjectId: projectId || record?.studioProjectId || "",
        },
      );
      toast.success(`${type} draft saved`);
      onSaved();
    } catch (err) {
      setError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <WorkspaceDialog
      title={`${record ? "Edit" : "Create"} ${type.toLowerCase()} draft`}
      onClose={onClose}
      onSubmit={save}
      busy={busy}
      error={error}
      submitLabel="Save draft"
    >
      <WorkspaceField
        label={type === "Message" ? "Subject" : "Title"}
        name="title"
        value={form.title}
        onChange={change}
        required
        wide
      />
      <WorkspaceField
        label={
          type === "Questionnaire"
            ? "Questions (one per line)"
            : type === "Message"
              ? "Message"
              : "Contract text"
        }
        name="content"
        value={form.content}
        onChange={change}
        type="textarea"
        wide
      />
      <p className="reference-help workspace-wide">
        Saved as an internal draft.{" "}
        {type === "Message"
          ? "This does not send a message to the client."
          : type === "Contract"
            ? "Client signing and document delivery are not enabled for this draft."
            : "Client responses and document delivery are not enabled for this draft."}
      </p>
    </WorkspaceDialog>
  );
}
export function ContactCreateMenu({
  contact,
  projectId,
  onProject,
  onDocument,
}) {
  const [open, setOpen] = useState(false),
    navigate = useNavigate();
  const query = new URLSearchParams({
    contact: contact._id,
    ...(projectId ? { project: projectId } : {}),
  }).toString();
  const options = [
    { name: "Project", icon: Folder, action: onProject },
    {
      name: "Invoice",
      icon: ReceiptText,
      action: () => navigate("/admin/invoices/new?" + query),
    },
    {
      name: "Contract",
      icon: FileSignature,
      action: () => onDocument("Contract"),
    },
    {
      name: "Questionnaire",
      icon: ClipboardList,
      action: () => onDocument("Questionnaire"),
    },
    {
      name: "Quote",
      icon: FileText,
      action: () => navigate("/admin/quotations?" + query),
    },
    {
      name: "Session",
      icon: CalendarDays,
      action: () => navigate("/admin/calendar?" + query),
    },
    { name: "Message", icon: Mail, action: () => onDocument("Message") },
  ];
  return (
    <div className="reference-create-menu">
      <button
        className="reference-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Create New <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <button
            className="reference-menu-dismiss"
            aria-label="Close create menu"
            onClick={() => setOpen(false)}
          />
          <div className="reference-dropdown" role="menu">
            {options
              .filter((option) => option.action)
              .map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    role="menuitem"
                    key={option.name}
                    onClick={() => {
                      setOpen(false);
                      option.action();
                    }}
                  >
                    <Icon size={17} />
                    {option.name}
                  </button>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
export function ContactNote({ note, onSave }) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(note || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      setError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  return editing ? (
    <div className="reference-note-editor">
      <textarea
        aria-label="Contact note"
        value={value}
        maxLength={5000}
        onChange={(event) => setValue(event.target.value)}
      />
      <WorkspaceError error={error} />
      <div>
        <button
          className="reference-text-button"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
        <button
          className="reference-button small"
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  ) : (
    <div>
      {note && <p className="reference-note-text">{note}</p>}
      <button
        className="reference-text-button"
        onClick={() => {
          setValue(note || "");
          setEditing(true);
        }}
      >
        {note ? "Edit note" : "Add Note"}
      </button>
    </div>
  );
}
export function ReferenceSection({ title, action, children }) {
  return (
    <section className="reference-section">
      <div className="reference-section-heading">
        <h2>{title}</h2>
        {action && (
          <button
            className="reference-text-button"
            aria-label={`Add ${title.toLowerCase()}`}
            onClick={action}
          >
            <Plus size={17} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
