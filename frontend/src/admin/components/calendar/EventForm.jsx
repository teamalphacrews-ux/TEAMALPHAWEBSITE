import { useState } from "react";
import { WorkspaceDialog, WorkspaceField } from "../operations/WorkspaceUI";
function localInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function EventForm({
  onClose,
  onSave,
  initialData,
  crew = [],
  leads = [],
  busy,
  error,
}) {
  const [form, setForm] = useState(() => ({
    title: "",
    type: "Wedding",
    location: "",
    description: "",
    teamMembers: [],
    ...initialData,
    start: localInput(initialData?.start),
    end: localInput(initialData?.end),
    lead: initialData?.lead?._id || initialData?.lead || "",
  }));
  const change = (name, value) => setForm((c) => ({ ...c, [name]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (busy || !Number.isFinite(Date.parse(form.start)) || !Number.isFinite(Date.parse(form.end)) || new Date(form.end) <= new Date(form.start)) return;
    onSave({
      ...form,
      start: new Date(form.start).toISOString(),
      end: new Date(form.end).toISOString(),
    });
  };
  return (
    <WorkspaceDialog
      title={initialData?._id ? "Edit studio event" : "Schedule event"}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Save event"
    >
      <div className="studio-form-grid">
        <WorkspaceField
          wide
          label="Event title"
          name="title"
          value={form.title}
          onChange={change}
          required
        />
        <WorkspaceField
          label="Occasion"
          name="type"
          value={form.type}
          onChange={change}
          options={[
            "Wedding",
            "Pre-Wedding",
            "Engagement",
            "Meeting",
            "Birthday",
            "Other",
          ]}
        />
        <WorkspaceField
          label="Linked enquiry / project"
          name="lead"
          value={form.lead}
          onChange={change}
          options={[
            { value: "", label: "Studio event" },
            ...leads.map((l) => ({ value: l._id, label: l.name })),
          ]}
        />
        <WorkspaceField
          label="Starts"
          name="start"
          value={form.start}
          onChange={change}
          type="datetime-local"
          required
        />
        <WorkspaceField
          label="Ends"
          name="end"
          value={form.end}
          onChange={change}
          type="datetime-local"
          min={form.start}
          required
        />
        <WorkspaceField
          wide
          label="Venue / location"
          name="location"
          value={form.location}
          onChange={change}
        />
        <WorkspaceField
          wide
          label="Shoot notes"
          name="description"
          value={form.description}
          onChange={change}
          type="textarea"
        />
      </div>
      {form.start && form.end && new Date(form.end) <= new Date(form.start) && (
        <p className="studio-error">The end must be after the start.</p>
      )}
      <fieldset className="workspace-crew-picker">
        <legend>Assigned crew</legend>
        {crew.map((member) => (
          <label key={member._id}>
            <input
              type="checkbox"
              checked={form.teamMembers.includes(member.name)}
              onChange={(event) =>
                change(
                  "teamMembers",
                  event.target.checked
                    ? [...form.teamMembers, member.name]
                    : form.teamMembers.filter((name) => name !== member.name),
                )
              }
            />
            <span>
              {member.name}
              <small>{member.specialty}</small>
            </span>
          </label>
        ))}
        {!crew.length && (
          <p className="studio-muted">
            Add crew members in Crew & scheduling first.
          </p>
        )}
      </fieldset>
      <p className="studio-muted">
        Event times use your browser’s timezone. Google-linked events keep their
        existing sync workflow.
      </p>
    </WorkspaceDialog>
  );
}
