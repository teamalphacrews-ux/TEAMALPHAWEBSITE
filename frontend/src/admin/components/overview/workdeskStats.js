import { eventStartDay, hasAllDayRange, shiftDayKey, studioDayKey, validStudioDay } from '../../../utils/studioTime.js';

export const taskGroups = ['Up next', 'In progress', 'In review', 'Done'];

function taskGroup(task) {
  if (task.status === 'completed') return 3;
  if (['In review', 'Awaiting your selection'].includes(task.productionStage)) return 2;
  if (task.productionStage && task.productionStage !== 'Not started') return 1;
  return 0;
}

export function taskBreakdown(tasks) {
  if (!tasks) return null;
  const counts = [0, 0, 0, 0];
  for (const task of tasks) counts[taskGroup(task)] += 1;
  return counts;
}

export function projectBreakdown(projects) {
  if (!projects) return null;
  return projects.reduce((counts, project) => {
    if (project.status !== 'Archived') counts[project.status === 'Completed' ? 0 : project.status === 'Booked' ? 1 : 2] += 1;
    return counts;
  }, [0, 0, 0]);
}

export function enquiryBreakdown(pipeline) {
  if (!pipeline) return null;
  return pipeline.reduce((counts, stage) => {
    if (stage.status !== 'Archived') counts[stage.status === 'Converted' ? 0 : stage.status === 'New' ? 2 : 1] += stage.count;
    return counts;
  }, [0, 0, 0]);
}

export function sessionBreakdown(events, now, today) {
  if (!events) return null;
  return events.reduce((counts, event) => {
    if (hasAllDayRange(event)) {
      counts[event.endDateExclusive <= today ? 0 : event.startDate <= today ? 1 : 2] += 1;
    } else {
      const start = Date.parse(event.start), end = Date.parse(event.end);
      if (Number.isFinite(start) && end > start) counts[end <= now ? 0 : start <= now ? 1 : 2] += 1;
    }
    return counts;
  }, [0, 0, 0]);
}

// Deadlines without a time are calendar dates in the studio, including Mongo's
// UTC-midnight representation. Scheduled sessions use their workspace time zone.
function taskDay(task, timezone) {
  const dateOnly = /^(\d{4}-\d\d-\d\d)(?:T00:00:00(?:\.000)?Z)?$/.exec(task.dueDate || '');
  return dateOnly && validStudioDay(dateOnly[1]) ? dateOnly[1] : studioDayKey(task.dueDate, timezone);
}

export function workBuckets(tasks, events, period, today, timezone) {
  const firstDate = new Date(today + 'T12:00:00Z');
  const weekOffset = (firstDate.getUTCDay() + 6) % 7;
  const dateFor = i => {
    if (period === 'weeks') return shiftDayKey(today, i * 7 - weekOffset);
    if (period === 'months') return new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + i, 1)).toISOString().slice(0, 10);
    return shiftDayKey(today, i);
  };
  const n = period === 'months' ? 6 : period === 'weeks' ? 8 : 7;
  const buckets = Array.from({ length: n }, (_, i) => ({ start: dateFor(i), end: dateFor(i + 1), tasks: 0, sessions: 0 }));
  function add(day, key) {
    if (!day || day < today || day >= buckets.at(-1).end) return;
    const bucket = buckets.find(row => row.start <= day && day < row.end);
    if (bucket) bucket[key] += 1;
  }
  for (const task of tasks || []) if (task.status !== 'completed') add(taskDay(task, timezone), 'tasks');
  for (const event of events || []) add(eventStartDay(event, timezone), 'sessions');
  return buckets;
}
