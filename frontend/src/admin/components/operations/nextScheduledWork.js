import { hasAllDayRange, studioDayBounds } from '../../../utils/studioTime.js';

// Prefer the first unfinished deadline. Undated work stays discoverable even
// when every dated task in the current view has finished.
export function nextProductionTask(tasks) {
  let next;
  let earliest = Infinity;
  for (const task of tasks) {
    if (!task?._id || task.status === 'completed') continue;
    const due = Date.parse(task.dueDate);
    const rank = Number.isFinite(due) ? due : Infinity;
    if (!next || rank < earliest) {
      next = task;
      earliest = rank;
    }
  }
  return next;
}

export function nextCalendarSession(events, now, timezone) {
  let next;
  let earliest = Infinity;
  for (const event of events) {
    if (!event?._id) continue;
    const allDay = hasAllDayRange(event);
    const start = Date.parse(allDay ? studioDayBounds(event.startDate, timezone).start : event.start);
    const end = Date.parse(allDay ? studioDayBounds(event.endDateExclusive, timezone).start : event.end);
    if (end > now && end > start && start < earliest) {
      next = event;
      earliest = start;
    }
  }
  return next;
}
