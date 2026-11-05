import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, ArrowUpRight, Mail, FolderHeart } from "lucide-react";
import toast from "react-hot-toast";
import {
  WorkspaceHeader,
  WorkspaceMetrics,
  WorkspaceError,
  WorkspaceSearch,
  WorkspaceEmpty,
  WorkspaceDialog,
  WorkspaceField,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
  recordDate,
} from "../components/operations/workspaceData";
const blank = {
  firstName: "",
  lastName: "",
  email: "",
  leadId: "",
  cloudLink: "",
  password: "",
};
export default function Clients() {
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/clients",
    "/api/leads",
  ]);
  const [clients = [], leads = []] = data;
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(undefined),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const open = (client) => {
    setEditing(client || null);
    setForm(
      client
        ? {
            ...blank,
            ...client,
            leadId: client.leadId?._id || client.leadId || "",
          }
        : blank,
    );
    setSaveError("");
  };
  const change = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const body = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        leadId: form.leadId,
        cloudLink: form.cloudLink,
        ...(!editing ? { password: form.password } : {}),
      };
      await workspaceRequest(
        editing ? "patch" : "post",
        "/api/studio/clients" + (editing ? "/" + editing._id : ""),
        body,
      );
      setEditing(undefined);
      toast.success(editing ? "Client updated" : "Client account created");
      reload();
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const visible = clients.filter(
    (client) =>
      (filter === "all" ||
        (filter === "linked" ? !!client.leadId : !client.leadId)) &&
      [client.firstName, client.lastName, client.email, client.leadId?.name]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="THE PEOPLE AT THE HEART OF IT"
        title="Your clients"
        description="A thoughtful directory of every client portal account."
      >
        <button className="studio-button primary" onClick={() => open(null)}>
          <Plus size={14} />
          Add client
        </button>
      </WorkspaceHeader>
      <WorkspaceMetrics
        loading={loading || (!!error && !data.length)}
        items={[
          {
            label: "Client accounts",
            value: clients.length,
            note: "Private client portal access",
          },
          {
            label: "Linked enquiries",
            value: clients.filter((c) => c.leadId).length,
            note: "Connected to your CRM",
          },
          {
            label: "Booked celebrations",
            value: clients.filter((c) => c.leadId?.status === "Converted")
              .length,
            note: "Linked confirmed enquiries",
          },
          {
            label: "Cloud delivery links",
            value: clients.filter((c) => c.cloudLink).length,
            note: "Recorded on client accounts",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      <section className="studio-card">
        <div className="studio-card-heading">
          <h2>Client directory</h2>
          <Link to="/admin/gallery">
            Open client galleries <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="studio-toolbar">
          <WorkspaceSearch
            value={query}
            onChange={setQuery}
            placeholder="Search clients or email…"
          />
          <select
            aria-label="Filter client links"
            className="studio-input workspace-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All accounts</option>
            <option value="linked">Linked to an enquiry</option>
            <option value="unlinked">No enquiry linked</option>
          </select>
        </div>
        {loading || !visible.length ? (
          <WorkspaceEmpty
            loading={loading}
            title={query ? "No clients match" : "A home for every client"}
            description="Create an account or link an existing client to their enquiry."
          />
        ) : (
          <div className="studio-table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Linked celebration</th>
                  <th>Portal & delivery</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <strong>
                        {client.firstName} {client.lastName}
                      </strong>
                      <a
                        className="workspace-contact"
                        href={"mailto:" + client.email}
                      >
                        <Mail size={11} />
                        {client.email}
                      </a>
                    </td>
                    <td>
                      <strong>{client.leadId?.name || "Not linked"}</strong>
                      <small>
                        {client.leadId?.eventType || "Client portal account"} ·{" "}
                        {client.leadId?.eventDate
                          ? recordDate(client.leadId.eventDate)
                          : "Date not set"}
                      </small>
                    </td>
                    <td>
                      <span className="studio-badge green">Client access</span>
                      {client.cloudLink && (
                        <a
                          href={client.cloudLink}
                          target="_blank"
                          rel="noreferrer"
                          className="workspace-contact"
                        >
                          Cloud delivery <ArrowUpRight size={11} />
                        </a>
                      )}
                    </td>
                    <td>{recordDate(client.createdAt)}</td>
                    <td>
                      <button
                        className="studio-icon-button"
                        aria-label={"Edit client " + client.firstName}
                        onClick={() => open(client)}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <WorkspaceDialog
          title={editing ? "Client details" : "Create client account"}
          onClose={() => setEditing(undefined)}
          onSubmit={save}
          busy={busy}
          error={saveError}
        >
          <div className="studio-form-grid">
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
              required
            />
            <WorkspaceField
              label="Email"
              name="email"
              value={form.email}
              onChange={change}
              type="email"
              required
            />
            <WorkspaceField
              label="Linked enquiry / project"
              name="leadId"
              value={form.leadId}
              onChange={change}
              options={[
                { value: "", label: "No linked enquiry" },
                ...leads.map((lead) => ({ value: lead._id, label: lead.name })),
              ]}
            />
            <WorkspaceField
              wide
              label="Cloud delivery link"
              name="cloudLink"
              value={form.cloudLink}
              onChange={change}
              type="url"
              help="An HTTPS folder link without embedded credentials."
            />
            {!editing && (
              <WorkspaceField
                wide
                label="Initial portal password"
                name="password"
                value={form.password}
                onChange={change}
                type="password"
                required
                help="At least 8 characters. Shared securely with your client; existing passwords are never displayed."
              />
            )}
          </div>
          {editing?.leadId && (
            <Link className="studio-button" to="/admin/projects">
              <FolderHeart size={13} />
              Open project workspace
            </Link>
          )}
        </WorkspaceDialog>
      )}
    </div>
  );
}
