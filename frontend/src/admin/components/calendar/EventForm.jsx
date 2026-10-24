import { useState } from "react";
import { WorkspaceDialog, WorkspaceField } from "../operations/WorkspaceUI";
import { DEFAULT_STUDIO_TIMEZONE, studioDateTimeInput, studioDateTimeToISO } from '../../../utils/studioTime';
export default function EventForm({
  onClose,
  onSave,
  initialData,
  crew = [],
  leads = [],
  busy,
  error,
  timezone = DEFAULT_STUDIO_TIMEZONE,
}) {
  const [validationError, setValidationError] = useState('');
  const [form, setForm] = useState(() => ({
    title: "",
    type: "Wedding",
    location: "",
    description: "",
    teamMembers: [],
    ...initialData,
    start: studioDateTimeInput(initialData?.start, timezone),
    end: studioDateTimeInput(initialData?.end, timezone),
    lead: initialData?.lead?._id || initialData?.lead || "",
  }));
  const change = (name, value) => setForm((c) => ({ ...c, [name]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    const start = studioDateTimeToISO(form.start, timezone), end = studioDateTimeToISO(form.end, timezone);
    if (!start || !end) { setValidationError(`Enter valid start and end times in ${timezone}. A daylight-saving clock change may make a selected time unavailable.`); return; }
    if (end <= start) { setValidationError('The end must be after the start.'); return; }
    setValidationError('');
    onSave({
      ...form,
      start,
      end,
    });
  };
  return (
    <WorkspaceDialog
      title={initialData?._id ? "Edit studio event" : "Schedule event"}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={validationError || error}
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
          label={`Starts · ${timezone}`}
          name="start"
          value={form.start}
          onChange={change}
          type="datetime-local"
          required
        />
        <WorkspaceField
          label={`Ends · ${timezone}`}
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
      {form.start && form.end && form.end <= form.start && (
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
        Event times use the studio timezone, {timezone}. Google-linked events keep their
        existing sync workflow.
      </p>
    </WorkspaceDialog>
  );
}
