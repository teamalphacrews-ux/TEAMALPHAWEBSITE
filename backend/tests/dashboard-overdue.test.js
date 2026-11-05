const test = require('node:test');
const assert = require('node:assert/strict');
const { studioDayStart } = require('../utils/studioDay');

test('overdue day boundary follows studio midnight, including the India date change before UTC', () => {
    assert.equal(studioDayStart('2026-10-24T18:29:59Z').toISOString(), '2026-10-23T18:30:00.000Z');
    assert.equal(studioDayStart('2026-10-24T18:30:00Z').toISOString(), '2026-10-24T18:30:00.000Z');
    assert.equal(studioDayStart('2026-10-25T07:00:00Z', 'Invalid/Timezone').toISOString(), '2026-10-24T18:30:00.000Z');
});

test('configured studio day retains the correct boundary through DST and fractional offsets', () => {
    assert.equal(studioDayStart('2026-03-08T20:00:00Z', 'America/New_York').toISOString(), '2026-03-08T05:00:00.000Z');
    assert.equal(studioDayStart('2026-11-01T20:00:00Z', 'America/New_York').toISOString(), '2026-11-01T04:00:00.000Z');
    assert.equal(studioDayStart('2026-10-25T09:00:00Z', 'Asia/Kathmandu').toISOString(), '2026-10-24T18:15:00.000Z');
    assert.throws(() => studioDayStart('invalid'), TypeError);
});

test('overview route counts only pending tasks before the configured studio day, excluding tasks due today', async () => {
    const Lead = require('../models/Lead'), Event = require('../models/Event'), Task = require('../models/Task');
    const Photographer = require('../models/Photographer'), DriveGallery = require('../models/DriveGallery');
    const Config = require('../models/StudioConfig'), pipeline = require('../services/enquiryPipeline');
    const replacements = [];
    const replace = (object, key, value) => { replacements.push([object, key, object[key]]); object[key] = value; };
    const rows = () => ({ sort() { return this; }, limit() { return this; }, select() { return this; }, populate() { return this; }, lean: async () => [] });
    let countFilter;
    const timezone = 'America/New_York';
    replace(pipeline, 'reconcile', async () => {});
    replace(Config, 'findOne', filter => { assert.deepEqual(filter, { key: 'studio' }); return { select: () => ({ lean: async () => ({ timezone }) }) }; });
    replace(Lead, 'aggregate', async () => []);
    for (const Model of [Event, Task]) replace(Model, 'aggregate', async () => []);
    for (const Model of [Lead, Event, Task]) replace(Model, 'find', rows);
    for (const Model of [Event, Photographer, DriveGallery]) replace(Model, 'countDocuments', async () => 0);
    replace(Task, 'countDocuments', async filter => { if (filter.dueDate) countFilter = filter; return filter.dueDate ? 1 : 4; });
    try {
        const router = require('../routes/dashboardRoutes');
        const handler = router.stack.find(layer => layer.route?.path === '/studio-overview').route.stack[0].handle;
        let body, code = 200;
        await handler({}, { status(value) { code = value; return this; }, json(value) { body = value; } });
        assert.equal(code, 200);
        assert.equal(body.summary.overdueTasks, 1);
        assert.equal(countFilter.status, 'pending');
        assert.equal(countFilter.dueDate.$ne, null);
        const start = studioDayStart(body.generatedAt, timezone);
        assert.equal(countFilter.dueDate.$lt.toISOString(), start.toISOString());
        const tasks = [
            { status: 'pending', dueDate: new Date(start.getTime() - 1) },
            { status: 'pending', dueDate: start },
            { status: 'pending', dueDate: new Date(start.getTime() + 12 * 60 * 60 * 1000) },
            { status: 'completed', dueDate: new Date(start.getTime() - 1) },
        ];
        assert.equal(tasks.filter(task => task.status === countFilter.status && task.dueDate < countFilter.dueDate.$lt).length, 1);
    } finally { for (const [object, key, original] of replacements.reverse()) object[key] = original; }
});
