import { useState } from "react";
import { Link } from "react-router-dom";
import { Save, Webhook, UsersRound, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import {
  WorkspaceHeader,
  WorkspaceError,
  WorkspaceField,
  WorkspaceEmpty,
} from "../components/operations/WorkspaceUI";
import {
  useWorkspaceData,
  workspaceRequest,
  recordError,
} from "../components/operations/workspaceData";
export default function Settings() {
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/settings",
  ]);
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [tab, setTab] = useState("profile");
  // The saved configuration is mounted as an editor so refreshing doesn't erase unsaved fields.
  const saved = data[0];
  const values = form || saved;
  const change = (name, value) =>
    setForm((current) => ({ ...saved, ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const result = await workspaceRequest("put", "/api/studio/settings", {
        ...values,
        quotationValidityDays: Number(values.quotationValidityDays),
      });
      setForm(result);
      toast.success("Studio settings saved");
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const sections = {
    profile: [
      { label: "Studio name", name: "studioName", required: true },
      { label: "Contact email", name: "email", type: "email" },
      { label: "Contact phone", name: "phone" },
      { label: "Website", name: "website", type: "url" },
      {
        label: "Studio address",
        name: "address",
        type: "textarea",
        wide: true,
      },
    ],
    proposals: [
      {
        label: "Document reference prefix",
        name: "invoicePrefix",
        required: true,
        help: "Used on quotation references. Existing invoice records are preserved.",
      },
      {
        label: "Default quotation validity (days)",
        name: "quotationValidityDays",
        type: "number",
        min: 0,
        max: 365,
        required: true,
      },
      {
        label: "Default quotation terms",
        name: "quotationTerms",
        type: "textarea",
        wide: true,
        help: "Applied to new quotations.",
      },
      {
        label: "Payment instructions",
        name: "paymentInstructions",
        type: "textarea",
        wide: true,
      },
      {
        label: "Standard deliverables",
        name: "defaultDeliverables",
        type: "textarea",
        wide: true,
      },
    ],
  };
  return (
    <div>
      <WorkspaceHeader
        eyebrow="MAKE IT YOUR STUDIO"
        title="Studio settings"
        description="The details behind a consistent client experience."
      >
        <span className="studio-badge">INR · Asia/Kolkata</span>
      </WorkspaceHeader>
      <WorkspaceError error={error} retry={reload} />
      <WorkspaceError error={saveError} />
      <div className="studio-tabs">
        {[
          ["profile", "Studio profile"],
          ["proposals", "Proposals & delivery"],
          ["connections", "Connections & access"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading || !values ? (
        <WorkspaceEmpty loading={loading} />
      ) : tab === "connections" ? (
        <div className="workspace-link-grid">
          {[
            {
              to: "/admin/integrations",
              title: "Enquiry webhook",
              copy: "Configure incoming enquiries and copy the endpoint payload.",
              icon: Webhook,
            },
            {
              to: "/admin/calendar",
              title: "Google Calendar",
              copy: "Review your calendar connection and synchronization.",
              icon: CalendarDays,
            },
            {
              to: "/admin/users",
              title: "Team & access",
              copy: "Manage studio administrators and existing accounts.",
              icon: UsersRound,
            },
          ].map((item) => (
            <Link
              className="studio-card workspace-settings-link"
              to={item.to}
              key={item.to}
            >
              <item.icon size={24} />
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
              <span>Open workspace →</span>
            </Link>
          ))}
        </div>
      ) : (
        <form onSubmit={save} className="studio-card workspace-settings-form">
          <div className="studio-card-heading">
            <div>
              <h2>
                {tab === "profile"
                  ? "Your studio identity"
                  : "Quotation & delivery defaults"}
              </h2>
              <p className="studio-card-subtitle">
                Preferences are saved for Team Alpha, with admin-only access.
              </p>
            </div>
          </div>
          <div className="studio-form-grid">
            {sections[tab].map((field) => (
              <WorkspaceField
                {...field}
                key={field.name}
                value={values[field.name]}
                onChange={change}
              />
            ))}
          </div>
          <div className="studio-modal-footer">
            <button className="studio-button primary" disabled={busy}>
              <Save size={14} />
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
