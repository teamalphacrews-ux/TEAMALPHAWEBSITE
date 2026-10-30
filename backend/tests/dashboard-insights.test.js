const test = require('node:test');
const assert = require('node:assert/strict');
const { overviewTimezone, overviewInsightWindow, overviewActivityPipeline, buildOverviewInsights, groupOverviewRecords } = require('../utils/studioOverviewInsights');

const empty = () => ({ leadCounts: [], leadActivity: [], eventActivity: [], taskActivity: [], taskDueActivity: [], pendingTaskCount: 0, completedTaskCount: 0 });
const now = new Date('2026-10-27T01:00:00Z');

test('empty and unavailable records remain distinct; empty charts contain seven real dates', () => {
    assert.equal(buildOverviewInsights(null, now), null);
    assert.equal(buildOverviewInsights({ ...empty(), eventActivity: undefined }, now), null);
    assert.equal(buildOverviewInsights({ ...empty(), completedTaskCount: undefined }, now), null);
    const data = buildOverviewInsights(empty(), now);
    assert.equal(data.enquiries.total, 0);
    assert.equal(data.enquiries.changePercent, null);
    assert.equal(data.enquiries.daily.length, 7);
    assert.equal(data.enquiries.daily[0].date, '2026-10-21');
    assert.equal(data.enquiries.daily[6].date, '2026-10-27');
    assert.deepEqual(data.performance, { totalTasks: 0, completedTasks: 0, pendingTasks: 0, totalEnquiries: 0, bookedEnquiries: 0 });
    assert.equal(data.activity.days.flatMap(day => day.hours).length, 168);
    assert.ok(data.activity.days.every(day => day.hours.every(value => value === 0)));
});

test('overview windows use calendar days across India midnight, DST and fractional offsets', () => {
    const india = overviewInsightWindow('2026-10-26T18:30:00Z', 'Asia/Kolkata');
    assert.equal(india.start.toISOString(), '2026-10-20T18:30:00.000Z');
    assert.equal(india.endDate, '2026-10-27');
    assert.equal(india.end.toISOString(), '2026-10-27T18:30:00.000Z');
    const dst = overviewInsightWindow('2026-03-09T01:00:00Z', 'America/New_York');
    assert.equal(dst.start.toISOString(), '2026-03-02T05:00:00.000Z');
    assert.equal(dst.end.toISOString(), '2026-03-09T04:00:00.000Z');
    assert.equal(overviewInsightWindow(now, 'Asia/Kathmandu').end.toISOString(), '2026-10-27T18:15:00.000Z');
    assert.equal(overviewTimezone('invalid'), 'Asia/Kolkata');
    assert.throws(() => overviewTimezone('invalid', true), { status: 400 });
    assert.throws(() => overviewTimezone({ $ne: null }, true), { status: 400 });
    assert.throws(() => overviewInsightWindow('not-a-date'), TypeError);
});

test('charts count complete grouped records and never invent task completion timestamps', () => {
    const data = empty();
    Object.assign(data, {
        leadCounts: [{ _id: 'Converted', count: 3 }, { _id: 'New', count: 5 }],
        leadActivity: [
            { _id: { date: '2026-10-20', hour: 9 }, count: 2 },
            { _id: { date: '2026-10-21', hour: 11 }, count: 2 },
            { _id: { date: '2026-10-27', hour: 0 }, count: 4 },
        ],
        eventActivity: [{ _id: { date: '2026-10-27', hour: 10 }, count: 2 }],
        taskActivity: [{ _id: { date: '2026-10-27', hour: 0 }, count: 1 }],
        taskDueActivity: [
            { _id: { date: '2026-10-27', hour: 5, status: 'pending' }, count: 3 },
            { _id: { date: '2026-10-27', hour: 5, status: 'completed' }, count: 2 },
        ],
        pendingTaskCount: 8, completedTaskCount: 6,
    });
    const result = buildOverviewInsights(data, now);
    assert.equal(result.enquiries.total, 6);
    assert.equal(result.enquiries.previousTotal, 2);
    assert.equal(result.enquiries.changePercent, 200);
    assert.equal(result.activity.days.at(-1).hours[0], 5);
    assert.equal(result.activity.days.at(-1).hours[10], 2);
    assert.deepEqual(result.rhythm.daily.at(-1), { date: '2026-10-27', enquiries: 4, events: 2, tasksDue: 5, completedTasksDue: 2 });
    assert.equal(result.performance.totalTasks, 14);
    assert.equal(result.performance.completedTasks, 6);
    assert.equal(result.performance.bookedEnquiries, 3);
    assert.match(result.activity.source, /scheduled event start times/);
    assert.equal(JSON.stringify(result).includes('completedAt'), false);
});

test('preview grouping respects boundaries and discards absent or invalid dates', () => {
    const window = overviewInsightWindow(now, 'Asia/Kolkata');
    const records = [{}, { createdAt: null }, { createdAt: '' }, { createdAt: 'invalid' },
        { createdAt: '2026-10-13T00:00:00Z' }, { createdAt: '2026-10-26T18:29:59Z' },
        { createdAt: '2026-10-26T18:30:00Z' }, { createdAt: '2026-10-29T01:00:00Z' }];
    assert.deepEqual(groupOverviewRecords(records, 'createdAt', window, false, now), [
        { _id: { date: '2026-10-26', hour: 23 }, count: 1 },
        { _id: { date: '2026-10-27', hour: 0 }, count: 1 },
    ]);
});

test('aggregation only returns grouped counts over a bounded range and validated fields', () => {
    const window = overviewInsightWindow(now, 'Asia/Kolkata');
    const pipeline = overviewActivityPipeline('dueDate', window.start, window.end, window.timezone, true);
    assert.deepEqual(pipeline[0], { $match: { dueDate: { $gte: window.start, $lt: window.end } } });
    assert.equal(pipeline[1].$group._id.date.$dateToString.timezone, 'Asia/Kolkata');
    assert.equal(pipeline[1].$group._id.status, '$status');
    assert.deepEqual(pipeline[1].$group.count, { $sum: 1 });
    assert.equal(pipeline.length, 2);
    assert.throws(() => overviewActivityPipeline('email', window.start, window.end, window.timezone), TypeError);
});

test('route uses requested display timezone and reports a failed aggregate instead of false zero charts', async () => {
    const Lead = require('../models/Lead'), Event = require('../models/Event'), Task = require('../models/Task');
    const Photographer = require('../models/Photographer'), DriveGallery = require('../models/DriveGallery');
    const Config = require('../models/StudioConfig'), enquiryPipeline = require('../services/enquiryPipeline');
    const replacements = [];
    const replace = (object, key, value) => { replacements.push([object, key, object[key]]); object[key] = value; };
    const rows = () => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, populate() { return this; }, lean: async () => [] });
    const aggregates = [];
    replace(enquiryPipeline, 'reconcile', async () => {});
    replace(Config, 'findOne', () => ({ select: () => ({ lean: async () => ({ timezone: 'Asia/Kolkata' }) }) }));
    for (const Model of [Lead, Event, Task]) {
        replace(Model, 'find', rows);
        replace(Model, 'aggregate', async stages => { aggregates.push(stages); return []; });
    }
    for (const Model of [Event, Task, Photographer, DriveGallery]) replace(Model, 'countDocuments', async () => 0);
    try {
        const router = require('../routes/dashboardRoutes');
        const handler = router.stack.find(layer => layer.route?.path === '/studio-overview').route.stack[0].handle;
        const response = () => ({ code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; } });
        const ok = response();
        await handler({ query: { timezone: 'America/New_York' } }, ok);
        assert.equal(ok.code, 200);
        assert.equal(ok.body.insights.timezone, 'America/New_York');
        assert.equal(aggregates.filter(stages => stages[0].$match).length, 4);
        assert.ok(aggregates.filter(stages => stages[0].$match).every(stages => stages[1].$group._id.date.$dateToString.timezone === 'America/New_York'));
        const invalid = response();
        await handler({ query: { timezone: 'Invalid/Zone' } }, invalid);
        assert.equal(invalid.code, 400);
        replace(Event, 'aggregate', async () => { throw new Error('database unavailable'); });
        const failed = response();
        await handler({ query: {} }, failed);
        assert.equal(failed.code, 500);
        assert.equal(failed.body.insights, undefined);
    } finally { for (const [object, key, original] of replacements.reverse()) object[key] = original; }
});
