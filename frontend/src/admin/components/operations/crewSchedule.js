export const normalizeCrewName = value => String(value || "").trim().toLowerCase();

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
