const { DEFAULT_STUDIO_TIMEZONE } = require('./studioDay');

const DAY = 24 * 60 * 60 * 1000;

function overviewTimezone(value, strict = false) {
    try {
        if (typeof value !== 'string' || !value) throw new RangeError();
        new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0));
        return value;
    } catch {
        if (strict) throw Object.assign(new Error('Choose a valid studio timezone.'), { status: 400 });
        return DEFAULT_STUDIO_TIMEZONE;
    }
}

function dayKey(value, timezone) {
    if (value === null || value === undefined || value === '') return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDay(key, amount) {
    return new Date(new Date(`${key}T00:00:00Z`).getTime() + amount * DAY).toISOString().slice(0, 10);
}

// Resolve calendar-day boundaries rather than subtracting 24 hours across DST.
function startOfDay(key, timezone) {
    const middle = new Date(`${key}T00:00:00Z`).getTime();
    let low = middle - 36 * 60 * 60 * 1000, high = middle + 36 * 60 * 60 * 1000;
    while (low < high) {
        const point = Math.floor((low + high) / 2);
        if (dayKey(point, timezone) < key) low = point + 1;
        else high = point;
    }
    return new Date(low);
}

function overviewInsightWindow(now = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
    timezone = overviewTimezone(timezone);
    const endDate = dayKey(now, timezone);
    if (!endDate) throw new TypeError('Choose a valid overview date.');
    const startDate = shiftDay(endDate, -6);
    const previousStartDate = shiftDay(startDate, -7);
    return {
        timezone, startDate, endDate, previousStartDate,
        start: startOfDay(startDate, timezone),
        previousStart: startOfDay(previousStartDate, timezone),
        end: startOfDay(shiftDay(endDate, 1), timezone),
        dates: Array.from({ length: 7 }, (_, index) => shiftDay(startDate, index)),
    };
}

// Each query runs through the existing workspace-routed Mongoose models. Only
// grouped counts leave the database; no client details or credentials are read.
function overviewActivityPipeline(field, from, to, timezone, withStatus = false) {
    if (!['createdAt', 'start', 'dueDate'].includes(field)) throw new TypeError('Unsupported overview date field.');
    const group = {
        date: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone } },
        hour: { $hour: { date: `$${field}`, timezone } },
    };
    if (withStatus) group.status = '$status';
    return [
        { $match: { [field]: { $gte: from, $lt: to } } },
        { $group: { _id: group, count: { $sum: 1 } } },
    ];
}

const validCount = value => Number.isFinite(value) && value >= 0;
const count = value => validCount(value) ? value : 0;
function rowsByDate(rows) {
    const result = new Map();
    for (const row of rows) {
        const key = row?._id?.date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(key || '')) result.set(key, (result.get(key) || 0) + count(row.count));
    }
    return result;
}

function buildOverviewInsights(data, now = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
    if (!data || !['leadActivity', 'eventActivity', 'taskActivity', 'taskDueActivity', 'leadCounts'].every(key => Array.isArray(data[key]))
        || !validCount(data.completedTaskCount) || !validCount(data.pendingTaskCount)) return null;
    const window = overviewInsightWindow(now, timezone);
    const leads = rowsByDate(data.leadActivity), events = rowsByDate(data.eventActivity);
    const due = rowsByDate(data.taskDueActivity);
    const completedDue = rowsByDate(data.taskDueActivity.filter(row => row?._id?.status === 'completed'));
    const currentTotal = window.dates.reduce((total, date) => total + (leads.get(date) || 0), 0);
    const previousTotal = Array.from({ length: 7 }, (_, index) => shiftDay(window.previousStartDate, index))
        .reduce((total, date) => total + (leads.get(date) || 0), 0);
    const activityDays = window.dates.map(date => ({ date, hours: Array(24).fill(0) }));
    const heatmap = new Map(activityDays.map(day => [day.date, day.hours]));
    for (const row of [...data.leadActivity, ...data.eventActivity, ...data.taskActivity]) {
        const hours = heatmap.get(row?._id?.date), hour = row?._id?.hour;
        if (hours && Number.isInteger(hour) && hour >= 0 && hour < 24) hours[hour] += count(row.count);
    }
    return {
        timezone: window.timezone,
        range: { startDate: window.startDate, endDate: window.endDate, days: 7 },
        enquiries: {
            total: currentTotal, previousTotal,
            changePercent: previousTotal ? Math.round((currentTotal - previousTotal) / previousTotal * 100) : null,
            daily: window.dates.map(date => ({ date, count: leads.get(date) || 0 })),
        },
        rhythm: { daily: window.dates.map(date => ({
            date, enquiries: leads.get(date) || 0, events: events.get(date) || 0,
            tasksDue: due.get(date) || 0, completedTasksDue: completedDue.get(date) || 0,
        })) },
        activity: {
            source: 'New enquiries, tasks created and scheduled event start times',
            days: activityDays,
        },
        performance: {
            totalTasks: data.completedTaskCount + data.pendingTaskCount,
            completedTasks: data.completedTaskCount, pendingTasks: data.pendingTaskCount,
            totalEnquiries: data.leadCounts.reduce((total, row) => total + count(row.count), 0),
            bookedEnquiries: count(data.leadCounts.find(row => row._id === 'Converted')?.count),
        },
    };
}

// The local design server feeds its explicitly labelled sample records through
// the same counting logic. This function is never used to seed live records.
function groupOverviewRecords(records, field, window, withStatus = false, before = window.end) {
    const rows = new Map();
    for (const record of records) {
        const value = record?.[field];
        if (value === null || value === undefined || value === '') continue;
        const date = new Date(value);
        if (!Number.isFinite(date.getTime()) || date < window.previousStart || date >= before) continue;
        const key = dayKey(date, window.timezone);
        const hour = Number(new Intl.DateTimeFormat('en', { timeZone: window.timezone, hour: 'numeric', hourCycle: 'h23' }).format(date));
        const id = { date: key, hour, ...(withStatus ? { status: record.status } : {}) };
        const mapKey = JSON.stringify(id);
        if (!rows.has(mapKey)) rows.set(mapKey, { _id: id, count: 0 });
        rows.get(mapKey).count += 1;
    }
    return [...rows.values()];
}

module.exports = { overviewTimezone, overviewInsightWindow, overviewActivityPipeline, buildOverviewInsights, groupOverviewRecords };
