import { studioDayKey, shiftDayKey, studioTimezone, studioDateTimeInput } from './studioTime.js';

/** Compatibility for an already-running, disposable local preview server.
 * Call only behind import.meta.env.DEV && user.isPreview. Never infer charts
 * from the overview endpoint's truncated record lists.
 */
export function buildPreviewOverviewInsights({ leads, tasks, events, now = new Date(), timezone } = {}) {
  if (![leads, tasks, events].every(Array.isArray)) return null;
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime())) return null;
  timezone = studioTimezone(timezone);
  const endDate = studioDayKey(instant, timezone);
  const startDate = shiftDayKey(endDate, -6), previousStartDate = shiftDayKey(startDate, -7);
  const dates = Array.from({ length: 7 }, (_, index) => shiftDayKey(startDate, index));
  const daily = dates.map(date => ({ date, enquiries: 0, events: 0, tasksDue: 0, completedTasksDue: 0 }));
  const days = dates.map(date => ({ date, hours: Array(24).fill(0) }));
  const byDate = new Map(daily.map(day => [day.date, day]));
  const heatmap = new Map(days.map(day => [day.date, day.hours]));
  const validDate = value => value != null && value !== '' && Number.isFinite(new Date(value).getTime());
  const addActivity = (value, field, created = false) => {
    if (!validDate(value) || (created && new Date(value) > instant)) return;
    const date = studioDayKey(value, timezone), day = byDate.get(date);
    if (!day) return;
    if (field) day[field] += 1;
    const hour = Number(studioDateTimeInput(value, timezone).slice(11, 13));
    heatmap.get(date)[hour] += 1;
  };
  let previousTotal = 0;
  for (const lead of leads) {
    if (validDate(lead.createdAt) && new Date(lead.createdAt) <= instant) {
      const date = studioDayKey(lead.createdAt, timezone);
      if (date >= previousStartDate && date < startDate) previousTotal += 1;
    }
    addActivity(lead.createdAt, 'enquiries', true);
  }
  for (const event of events) addActivity(event.start, 'events');
  for (const task of tasks) {
    addActivity(task.createdAt, null, true);
    if (!validDate(task.dueDate)) continue;
    const day = byDate.get(studioDayKey(task.dueDate, timezone));
    if (day) { day.tasksDue += 1; if (task.status === 'completed') day.completedTasksDue += 1; }
  }
  const total = daily.reduce((sum, day) => sum + day.enquiries, 0);
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  return {
    timezone, range: { startDate, endDate, days: 7 },
    enquiries: { total, previousTotal, changePercent: previousTotal ? Math.round((total - previousTotal) / previousTotal * 100) : null,
      daily: daily.map(day => ({ date: day.date, count: day.enquiries })) },
    rhythm: { daily },
    activity: { source: 'New enquiries, tasks created and scheduled event start times', days },
    performance: { totalTasks: completedTasks + pendingTasks, completedTasks, pendingTasks,
      totalEnquiries: leads.length, bookedEnquiries: leads.filter(lead => lead.status === 'Converted').length },
  };
}
