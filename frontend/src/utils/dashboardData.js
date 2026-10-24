import { eventOnStudioDay, studioDayKey } from './studioTime.js';

const dueKey = (value, timezone) => {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return studioDayKey(value, timezone);
  const instant = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(instant) && new Date(instant).toISOString().startsWith(value) ? value : '';
};
export function taskIsOverdue(task, now = new Date(), timezone = 'Asia/Kolkata') {
  const key = dueKey(task.dueDate, timezone);
  return !!key && key < studioDayKey(now, timezone);
}

export function dashboardWork(events = [], tasks = [], now = new Date(), timezone = 'Asia/Kolkata') {
  const today = studioDayKey(now, timezone);
  const activeEvents = events.filter(event => Number.isFinite(Date.parse(event.start)) && Number.isFinite(Date.parse(event.end)) && Date.parse(event.end) > Date.parse(now));
  const orderedEvents = [...activeEvents].sort((a, b) => Number(eventOnStudioDay(b, today, timezone)) - Number(eventOnStudioDay(a, today, timezone)) || Date.parse(a.start) - Date.parse(b.start));
  const orderedTasks = tasks.filter(task => task.status !== 'completed').map((task, index) => ({ task, index })).sort((a, b) => Number(taskIsOverdue(b.task, now, timezone)) - Number(taskIsOverdue(a.task, now, timezone)) || (dueKey(a.task.dueDate, timezone) || '9999').localeCompare(dueKey(b.task.dueDate, timezone) || '9999') || a.index - b.index).map(value => value.task);
  return { events: orderedEvents, tasks: orderedTasks, todayEvents: orderedEvents.filter(event => eventOnStudioDay(event, today, timezone)).length, overdueTasks: orderedTasks.filter(task => taskIsOverdue(task, now, timezone)).length };
}
