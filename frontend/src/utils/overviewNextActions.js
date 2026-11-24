import { recordDestination } from './studioNavigation.js';
import { dayKeyDifference, eventStartDay, hasAllDayRange, studioDayKey, validStudioDay } from './studioTime.js';

const actionableLeadStages = new Set(['New', 'Follow-up', 'Meeting', 'Negotiation']);

// Tasks and follow-ups are entered with date inputs. Mongo also returns these
// calendar dates as UTC-midnight strings. Preserve the day the studio picked.
function deadlineDay(value, timezone) {
  if (!value) return '';
  const calendarDate = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  if (calendarDate) return validStudioDay(calendarDate[1]) ? calendarDate[1] : '';
  return studioDayKey(value, timezone);
}

const sameDayPriority = { event: 0, enquiry: 1, invoice: 2, task: 3 };

const assignedActions = [
  ['/admin/post-production', 'Review production tasks', 'Open the task board to see due dates and current editing stages.'],
  ['/admin/crm', 'Review enquiries', 'Open a client conversation to check its stage and next follow-up.'],
  ['/admin/calendar', 'Check the shoot schedule', 'Review upcoming sessions, times and locations.'],
  ['/admin/studio-projects', 'Review projects', 'Open a project to check the crew, schedule and delivery.'],
  ['/admin/invoices', 'Review invoices', 'Check drafts and outstanding payments in the invoice register.'],
  ['/admin/quotations', 'Review quotes', 'Check proposals that are in preparation or awaiting a client.'],
  ['/admin/contacts', 'Find a client', 'Open a client profile to see their linked work.'],
];

export function assignedOverviewAction(allowedLinks) {
  const match = assignedActions.find(([path]) => allowedLinks.some(link => link.path === path));
  if (match) return { path: match[0], label: match[1], detail: match[2] };
  const first = allowedLinks[0];
  return first ? { path: first.path, label: 'Open ' + first.name, detail: 'Continue in an area assigned to your account.' } : null;
}

export function overviewNextActions(overview, now, timezone) {
  if (!overview) return [];
  const today = studioDayKey(now, timezone);
  const actions = [];

  function addDeadline(action, day) {
    const days = day ? dayKeyDifference(day, today) : null;
    let timing = 'undated';
    let priority = 5;
    if (days !== null) {
      timing = days < 0 ? 'overdue' : days === 0 ? 'today' : 'upcoming';
      priority = days < 0 ? 1 : days === 0 ? 2 : 4;
    }
    actions.push({ ...action, timing, priority, day });
  }

  for (const event of overview.upcomingEvents || []) {
    if (!event._id || !event.title) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (hasAllDayRange(event) ? event.endDateExclusive <= today : end <= now.getTime()) continue;
    const action = {
      kind: 'event', title: event.title, context: event.location, at: event.start, allDay: event.allDay === true,
      to: recordDestination('event', event._id), label: 'Open event',
    };
    if (!action.allDay && start <= now.getTime() + 3600000) {
      actions.push({ ...action, priority: 0, timing: start <= now.getTime() ? 'ongoing' : 'soon', day: today });
    } else {
      const startsOn = eventStartDay(event, timezone);
      const day = startsOn < today ? today : startsOn;
      addDeadline(action, day);
    }
  }

  for (const task of overview.actionQueue || []) {
    if (!task._id || !task.title || task.status !== 'pending') continue;
    addDeadline({
      kind: 'task', title: task.title, context: task.lead?.name,
      to: '/admin/post-production?' + new URLSearchParams({ task: task._id }), label: 'Open task',
    }, deadlineDay(task.dueDate, timezone));
  }

  const enquiries = new Map((overview.recentEnquiries || []).map(lead => [lead._id, lead]));
  for (const lead of overview.scheduledFollowUps || []) enquiries.set(lead._id, lead);
  for (const lead of enquiries.values()) {
    if (!lead._id || !lead.name || !actionableLeadStages.has(lead.status)) continue;
    const action = { kind: 'enquiry', context: lead.eventType, to: recordDestination('enquiry', lead._id), label: 'Open enquiry' };
    const day = deadlineDay(lead.followUpDate, timezone);
    if (day) {
      addDeadline({ ...action, title: 'Follow up with ' + lead.name }, day);
    } else if (lead.status === 'New') {
      actions.push({ ...action, title: 'Review ' + lead.name + '’s enquiry', timing: 'new', priority: 3, day: studioDayKey(lead.createdAt, timezone) });
    }
  }

  for (const invoice of overview.draftInvoices || []) {
    if (!invoice._id || !invoice.clientName) continue;
    actions.push({
      kind: 'invoice', title: 'Review the draft invoice for ' + invoice.clientName,
      context: invoice.documentNumber, to: '/admin/invoices/' + encodeURIComponent(invoice._id),
      label: 'Review invoice', timing: 'review', priority: 3, day: studioDayKey(invoice.createdAt, timezone),
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.day.localeCompare(b.day) ||
    sameDayPriority[a.kind] - sameDayPriority[b.kind] ||
    (a.kind === 'event' ? Date.parse(a.at) - Date.parse(b.at) : 0));
}
