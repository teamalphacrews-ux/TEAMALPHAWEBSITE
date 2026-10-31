const { validDay, validTimezone, dateStart } = require('./calendarDateRange');
function eventError(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
function eventFields(body, current = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    eventError("An event object is required");
  const value = { ...current, ...body };
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title || title.length > 200)
    eventError("An event title is required (maximum 200 characters)");
  if (value.allDay !== undefined && typeof value.allDay !== 'boolean') eventError('Choose a valid all-day setting');
  let start = new Date(value.start), end = new Date(value.end);
  if (value.allDay === true) {
    if (!validDay(value.startDate) || !validDay(value.endDateExclusive) || value.endDateExclusive <= value.startDate) eventError('Choose a valid all-day date range');
    if (!validTimezone(value.dateTimezone)) eventError('Choose a valid calendar timezone');
    try { start = dateStart(value.startDate, value.dateTimezone); end = dateStart(value.endDateExclusive, value.dateTimezone); }
    catch { eventError('Choose calendar dates that exist in the selected timezone'); }
  }
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  )
    eventError("The event end must be after its start");
  if (
    ![
      "Wedding",
      "Pre-Wedding",
      "Engagement",
      "Meeting",
      "Birthday",
      "Other",
    ].includes(value.type || "Wedding")
  )
    eventError("Invalid event type");
  if (
    !Array.isArray(value.teamMembers || []) ||
    (value.teamMembers || []).length > 40 ||
    (value.teamMembers || []).some(
      (name) => typeof name !== "string" || !name.trim() || name.length > 120,
    )
  )
    eventError("Invalid crew assignment");
  const output = {
    title,
    start,
    end,
    allDay: value.allDay === true,
    startDate: value.allDay === true ? value.startDate : '',
    endDateExclusive: value.allDay === true ? value.endDateExclusive : '',
    dateTimezone: value.allDay === true ? value.dateTimezone : '',
    type: value.type || "Wedding",
    teamMembers: [
      ...new Set((value.teamMembers || []).map((name) => name.trim())),
    ],
  };
  for (const field of ["location", "description"]) {
    if (value[field] !== undefined && typeof value[field] !== "string")
      eventError("Invalid " + field);
    output[field] = (value[field] || "").trim();
    if (output[field].length > (field === "description" ? 6000 : 500))
      eventError(field + " is too long");
  }
  const lead = value.lead ? String(value.lead) : null;
  if (lead && !/^[a-f\d]{24}$/i.test(lead)) eventError("Invalid project link");
  output.lead = lead;
  for(const key of ['contactId','studioProjectId']){
    const id=value[key]?String(value[key]):null;
    if(id&&!/^[a-f\d]{24}$/i.test(id))eventError('Invalid '+key);
    if(value[key]!==undefined)output[key]=id;
  }
  return output;
}
function crewOverlap(event, candidates) {
  const names = new Set(
    event.teamMembers.map((name) => name.trim().toLowerCase()),
  );
  return candidates.find(
    (other) =>
      new Date(other.start) < event.end &&
      new Date(other.end) > event.start &&
      (other.teamMembers || []).some((name) =>
        names.has(name.trim().toLowerCase()),
      ),
  );
}
module.exports = { eventFields, crewOverlap };
