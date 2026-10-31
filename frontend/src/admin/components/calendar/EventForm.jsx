import { useState } from "react";
import { WorkspaceDialog, WorkspaceField } from "../operations/WorkspaceUI";
import { DEFAULT_STUDIO_TIMEZONE, studioDateTimeInput, studioDateTimeToISO, studioDayKey, shiftDayKey, validStudioDay } from '../../../utils/studioTime';
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
    allDay: initialData?.allDay === true,
    startDate: initialData?.startDate || studioDayKey(initialData?.start, timezone),
    lastDate: initialData?.endDateExclusive ? shiftDayKey(initialData.endDateExclusive, -1) : studioDayKey(initialData?.start, timezone),
    lead: initialData?.lead?._id || initialData?.lead || "",
  }));
  const change = (name, value) => setForm((c) => ({ ...c, [name]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (form.allDay && (!validStudioDay(form.startDate) || !validStudioDay(form.lastDate) || form.lastDate < form.startDate)) { setValidationError('Choose a valid start and last day.'); return; }
    const endDateExclusive = form.allDay ? shiftDayKey(form.lastDate, 1) : '';
    const start = studioDateTimeToISO(form.allDay ? form.startDate + 'T00:00' : form.start, timezone);
    const end = studioDateTimeToISO(form.allDay ? endDateExclusive + 'T00:00' : form.end, timezone);
    if (!start || !end) { setValidationError(`Enter valid start and end times in ${timezone}. A daylight-saving clock change may make a selected time unavailable.`); return; }
    if (end <= start) { setValidationError('The end must be after the start.'); return; }
    setValidationError('');
    onSave({
      ...form,
      start,
      end,
      allDay: form.allDay,
      startDate: form.allDay ? form.startDate : '',
      endDateExclusive,
      dateTimezone: form.allDay ? timezone : '',
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
        <label className="calendar-all-day"><input type="checkbox" checked={form.allDay} onChange={event => change('allDay', event.target.checked)} /><span>All-day event</span></label>
        {form.allDay ? <>
          <WorkspaceField label="First day" name="startDate" value={form.startDate} onChange={change} type="date" required />
          <WorkspaceField label="Last day" name="lastDate" value={form.lastDate} onChange={change} type="date" min={form.startDate} required help="Includes this day." />
        </> : <>
          <WorkspaceField label={`Starts · ${timezone}`} name="start" value={form.start} onChange={change} type="datetime-local" required />
          <WorkspaceField label={`Ends · ${timezone}`} name="end" value={form.end} onChange={change} type="datetime-local" min={form.start} required />
        </>}
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
      {!form.allDay && form.start && form.end && form.end <= form.start && (
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
        Event times use your selected time zone, {timezone}. Google-linked events keep their
        existing sync workflow.
      </p>
    </WorkspaceDialog>
  );
}
