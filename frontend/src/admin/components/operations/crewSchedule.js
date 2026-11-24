export const normalizeCrewName = value => String(value || "").trim().toLowerCase();

const shootTypes = new Set(["Wedding", "Pre-Wedding", "Engagement", "Birthday"]);

// Conflicts arrive in roster order. Show the first overlap in time, choosing
// the editable booking when one side belongs to a read-only calendar.
export function nextCrewAction(upcomingEvents, conflicts) {
  let earliest;
  for (const conflict of conflicts) {
    if (!conflict.first._id || !conflict.second._id) continue;
    if (!earliest || Date.parse(conflict.second.start) < Date.parse(earliest.second.start)) earliest = conflict;
  }
  if (earliest) {
    const event = earliest.second.isReadOnly && !earliest.first.isReadOnly ? earliest.first : earliest.second;
    return { event, member: earliest.member, other: event === earliest.first ? earliest.second : earliest.first, kind: "overlap" };
  }
  const unassigned = upcomingEvents.find(event => event._id && !event.isReadOnly && shootTypes.has(event.type) && !event.teamMembers?.some(normalizeCrewName));
  if (unassigned) return { event: unassigned, kind: "unassigned" };
  const next = upcomingEvents.find(event => event._id);
  return next ? { event: next, kind: "scheduled" } : null;
}

export function deriveCrewSchedule(crew, events, now) {
  const upcomingEvents = events.filter(event => {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > now && end > start;
  }).sort((first, second) => new Date(first.start) - new Date(second.start));
  const assignments = new Map(crew.map(member => [member._id, upcomingEvents.filter(event =>
    (event.teamMembers || []).some(name => normalizeCrewName(name) === normalizeCrewName(member.name))
  )]));
  const conflicts = [];
  crew.forEach(member => {
    const booked = assignments.get(member._id) || [];
    for (let i = 0; i < booked.length; i += 1) {
      for (let j = i + 1; j < booked.length; j += 1) {
        if (new Date(booked[j].start) >= new Date(booked[i].end)) break;
        if (new Date(booked[i].start) < new Date(booked[j].end)) conflicts.push({ member, first: booked[i], second: booked[j] });
      }
    }
  });
  return { upcomingEvents, assignments, conflicts };
}
