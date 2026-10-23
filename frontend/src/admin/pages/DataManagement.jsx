import { useState } from "react";
import { Plus, Pencil, HardDrive, Archive, ShieldCheck } from "lucide-react";
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
  label: "",
  lead: "",
  mediaType: "Photos",
  storageLocation: "",
  sizeGb: 0,
  backupLocation: "",
  backupStatus: "Pending",
  checksum: "",
  notes: "",
};
export default function DataManagement() {
  const { data, loading, error, reload } = useWorkspaceData([
    "/api/studio/assets",
    "/api/leads",
  ]);
  const [assets = [], leads = []] = data;
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(undefined),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(""),
    [archiving, setArchiving] = useState(null);
  const open = (record) => {
    setEditing(record || null);
    setForm(
      record
        ? { ...blank, ...record, lead: record.lead?._id || record.lead || "" }
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
      await workspaceRequest(
        editing ? "put" : "post",
        "/api/studio/assets" + (editing ? "/" + editing._id : ""),
        { ...form, sizeGb: Number(form.sizeGb) },
      );
      setEditing(undefined);
      toast.success("Storage record saved");
      reload();
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const archive = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await workspaceRequest("delete", "/api/studio/assets/" + archiving._id);
      setArchiving(null);
      toast.success("Metadata archived");
      reload();
    } catch (err) {
      setSaveError(recordError(err));
    } finally {
      setBusy(false);
    }
  };
  const visible = assets.filter(
    (record) =>
      (filter === "all" || record.backupStatus === filter) &&
      [
        record.label,
        record.lead?.name,
        record.storageLocation,
        record.mediaType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div>
      <WorkspaceHeader
        eyebrow="CARE FOR EVERY FRAME"
        title="Data & backups"
        description="Know where your footage lives and when its backup was checked."
      >
        <button className="studio-button primary" onClick={() => open(null)}>
          <Plus size={14} />
          Add storage record
        </button>
      </WorkspaceHeader>
      <WorkspaceMetrics
        loading={loading || (!!error && !data.length)}
        items={[
          {
            label: "Storage records",
            value: assets.length,
            note: "Manually catalogued folders",
          },
          {
            label: "Recorded size",
            value:
              assets
                .reduce((sum, r) => sum + r.sizeGb, 0)
                .toLocaleString("en-IN") + " GB",
            note: "Based on entered metadata",
          },
          {
            label: "Backups marked verified",
            value: assets.filter((r) => r.backupStatus === "Verified").length,
            note: "Checked by your studio team",
          },
          {
            label: "Awaiting a check",
            value: assets.filter((r) => r.backupStatus !== "Verified").length,
            note: "Pending or needs attention",
          },
        ]}
      />
      <WorkspaceError error={error} retry={reload} />
      <div className="workspace-info">
        <ShieldCheck size={16} />
        <p>
          Backup status is a manual studio record. This workspace does not scan
          your NAS or move files. Record folder locations without passwords.
        </p>
      </div>
      <section className="studio-card">
        <div className="studio-toolbar">
          <WorkspaceSearch
            value={query}
            onChange={setQuery}
            placeholder="Search project, folder or location…"
          />
          <select
            aria-label="Filter backup status"
            className="studio-input workspace-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["all", "Pending", "Verified", "Needs attention"].map((v) => (
              <option value={v} key={v}>
                {v === "all" ? "All backup states" : v}
              </option>
            ))}
          </select>
        </div>
        {loading || !visible.length ? (
          <WorkspaceEmpty
            loading={loading}
            title="Every frame deserves a safe home"
            description="Catalogue a shoot folder, its primary location and backup."
          />
        ) : (
          <div className="studio-table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th>Record / project</th>
                  <th>Primary location</th>
                  <th>Size</th>
                  <th>Backup check</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <strong>{record.label}</strong>
                      <small>
                        {record.lead?.name || "Studio files"} ·{" "}
                        {record.mediaType}
                      </small>
                    </td>
                    <td>
                      <span className="workspace-path">
                        <HardDrive size={13} />
                        {record.storageLocation}
                      </span>
                      {record.backupLocation && (
                        <small>Backup: {record.backupLocation}</small>
                      )}
                    </td>
                    <td>{record.sizeGb} GB</td>
                    <td>
                      <span
                        className={
                          "studio-badge " +
                          (record.backupStatus === "Verified"
                            ? "green"
                            : record.backupStatus === "Needs attention"
                              ? "rose"
                              : "gold")
                        }
                      >
                        {record.backupStatus}
                      </span>
                      <small>
                        {record.verifiedAt
                          ? "Recorded " + recordDate(record.verifiedAt)
                          : "Not yet verified"}
                      </small>
                    </td>
                    <td>
                      <button
                        className="studio-icon-button"
                        aria-label={"Edit storage " + record.label}
                        onClick={() => open(record)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="studio-icon-button"
                        aria-label={"Archive metadata " + record.label}
                        onClick={() => {
                          setArchiving(record);
                          setSaveError("");
                        }}
                      >
                        <Archive size={14} />
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
          title={editing ? "Storage & backup record" : "Catalogue your footage"}
          onClose={() => setEditing(undefined)}
          onSubmit={save}
          busy={busy}
          error={saveError}
        >
          <div className="studio-form-grid">
            {[
              { label: "Record name", name: "label", required: true },
              {
                label: "Project",
                name: "lead",
                options: [
                  { value: "", label: "Studio files" },
                  ...leads.map((l) => ({ value: l._id, label: l.name })),
                ],
              },
              {
                label: "Media type",
                name: "mediaType",
                options: ["Photos", "Video", "Audio", "Project files", "Other"],
              },
              {
                label: "Size in GB",
                name: "sizeGb",
                type: "number",
                min: 0,
                step: "0.01",
              },
              {
                label: "Primary folder location",
                name: "storageLocation",
                wide: true,
                required: true,
              },
              {
                label: "Backup folder location",
                name: "backupLocation",
                wide: true,
                required: form.backupStatus === "Verified",
              },
              {
                label: "Backup check status",
                name: "backupStatus",
                options: ["Pending", "Verified", "Needs attention"],
              },
              { label: "Checksum / manifest reference", name: "checksum" },
              { label: "Notes", name: "notes", type: "textarea", wide: true },
            ].map((field) => (
              <WorkspaceField
                key={field.name}
                {...field}
                value={form[field.name]}
                onChange={change}
              />
            ))}
          </div>
          <p className="studio-muted">
            Choose Verified only after your team has checked the backup. A
            backup location is required.
          </p>
        </WorkspaceDialog>
      )}
      {archiving && (
        <WorkspaceDialog
          title="Archive storage metadata?"
          onClose={() => setArchiving(null)}
          onSubmit={archive}
          busy={busy}
          error={saveError}
          submitLabel="Archive record"
        >
          <p>
            This removes {archiving.label} from the active catalogue. The
            metadata is retained; files in storage are untouched.
          </p>
        </WorkspaceDialog>
      )}
    </div>
  );
}
