const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { parseProfileUpdate } = require('../utils/profileUpdate');
const { buildStudioOverview } = require('../utils/studioOverview');

process.env.JWT_SECRET = 'test-only-studio-secret-never-use-in-production';
const tokenFor = (role, id = '507f1f77bcf86cd799439011') => jwt.sign({ user: { id, role } }, process.env.JWT_SECRET);

function dispatch(router, { method = 'GET', url = '/', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const req = { method, url, headers, body, header: name => headers[name.toLowerCase()] };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(value) { resolve({ status: this.statusCode, body: value }); },
            send(value) { resolve({ status: this.statusCode, body: value }); }
        };
        router.handle(req, res, error => error ? reject(error) : resolve({ status: 404 }));
    });
}

test('JWT and role boundary reject missing, invalid, expired and client credentials', async () => {
    const app = express.Router();
    app.get('/studio', auth, requireAdmin, (req, res) => res.json({ role: req.user.role }));
    const cases = [
        [undefined, 401], ['invalid-token', 401],
        [jwt.sign({ user: { id: 'x', role: 'admin' } }, process.env.JWT_SECRET, { expiresIn: -1 }), 401],
        [jwt.sign({ user: { id: 'x' } }, process.env.JWT_SECRET), 401],
        [tokenFor('client'), 403], [tokenFor('client', 'hardcoded-admin-id'), 403],
        [tokenFor('admin'), 200]
    ];
    for (const [token, status] of cases) {
        const response = await dispatch(app, { url: '/studio', headers: token ? { authorization: `Bearer ${token}` } : {} });
        assert.equal(response.status, status);
    }
    assert.equal((await dispatch(app, { url: '/studio', headers: { 'x-auth-token': tokenFor('admin') } })).status, 200);
});

test('actual studio routes deny clients before querying models or external integrations', async t => {
    const app = express.Router();
    const routeFiles = {
        leads: 'leadroutes', calendar: 'calendarRoutes', tasks: 'taskRoutes',
        photographers: 'photographerRoutes', finance: 'financeRoutes', invoices: 'invoiceRoutes',
        dashboard: 'dashboardRoutes', notifications: 'notificationRoutes',
        'google-sheets': 'googleSheetRoutes', gallery: 'galleryRoutes',
        'drive-gallery': 'driveGalleryRoutes', media: 'media', chats: 'chatRoutes', webhooks: 'webhookRoutes'
    };
    for (const [prefix, file] of Object.entries(routeFiles)) {
        app.use(`/api/${prefix}`, require(`../routes/${file}`));
    }
    const requests = [
        ['GET', '/leads'], ['POST', '/leads'], ['GET', '/calendar'], ['GET', '/tasks'],
        ['GET', '/photographers'], ['GET', '/finance/overview'], ['GET', '/invoices'],
        ['GET', '/dashboard/studio-overview'], ['POST', '/notifications/create'],
        ['GET', '/google-sheets'], ['PUT', '/google-sheets/cell'], ['POST', '/google-sheets/row'],
        ['GET', '/gallery'], ['GET', '/drive-gallery'], ['POST', '/drive-gallery'],
        ['POST', '/media/upload'], ['GET', '/chats/admin/conversations'],
        ['GET', '/chats/search-users'], ['PUT', '/chats/mark-as-seen'], ['GET', '/webhooks/enquiries/status']
    ];
    for (const [method, path] of requests) {
        const response = await dispatch(app, { url: `/api${path}`,
            method, headers: { 'x-auth-token': tokenFor('client'), 'Content-Type': 'application/json' },
            body: {}
        });
        assert.equal(response.status, 403, `${method} ${path} must deny client access`);
    }
    // Client messages still have their own authenticated read endpoint.
    const ChatRoom = require('../models/ChatRoom');
    t.mock.method(ChatRoom, 'findOne', async () => ({ unreadCountUser: 2 }));
    const unread = await dispatch(app, { url: '/api/chats/unread', headers: { 'x-auth-token': tokenFor('client') } });
    assert.equal(unread.status, 200);
    assert.equal(unread.body.count, 2);
    const foreignMedia = await dispatch(app, { url: '/api/media/files/other-client', headers: { 'x-auth-token': tokenFor('client') } });
    assert.equal(foreignMedia.status, 403);
    const webhookStatus = await dispatch(app, { url: '/api/webhooks/enquiries/status', headers: { 'x-auth-token': tokenFor('admin') } });
    assert.equal(webhookStatus.status, 200);
    assert.deepEqual(Object.keys(webhookStatus.body).sort(), ['authentication', 'configured', 'idempotencyHeader', 'method', 'path']);
});

test('profile parsing rejects role escalation and whitelists name fields', () => {
    assert.throws(() => parseProfileUpdate({ name: 'Client User', role: 'admin' }, 'client'), { status: 403 });
    assert.throws(() => parseProfileUpdate({ name: 'Admin User', role: 'client' }, 'admin'), { status: 403 });
    for (const body of [null, [], {}, { name: '' }, { name: '   ' }, { name: 22 }, { name: 'x'.repeat(121) }]) {
        assert.throws(() => parseProfileUpdate(body, 'client'), { status: 400 });
    }
    assert.deepEqual(parseProfileUpdate({ name: '  Alpha   Studio Owner  ', role: 'admin',
        email: 'ignored', password: 'ignored', $set: { role: 'client' } }, 'admin'),
    { firstName: 'Alpha', lastName: 'Studio Owner' });
    assert.deepEqual(parseProfileUpdate({ name: 'Alpha' }, 'client'), { firstName: 'Alpha' });
});

const emptyOverview = () => ({
    leadCounts: [], upcomingEventCount: 0, pendingTaskCount: 0, overdueTaskCount: 0,
    activeCrew: 0, clientCollections: 0, events: [], datedTasks: [], undatedTasks: [], recentLeads: []
});

test('overview counts all enquiries and tasks, preserves zero pipeline stages and omits sensitive fields', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    const data = emptyOverview();
    Object.assign(data, {
        leadCounts: [{ _id: 'New', count: 9 }, { _id: 'Follow-up', count: 3 },
            { _id: 'Converted', count: 5 }, { _id: 'Archived', count: 2 }],
        pendingTaskCount: 30, overdueTaskCount: 12, upcomingEventCount: 9, activeCrew: 4,
        clientCollections: 8,
        events: [{ _id: 'e1', title: 'Wedding', start: now, end: now, googleEventId: 'private' }],
        datedTasks: [{ _id: 't1', title: 'Deliver film', status: 'pending', dueDate: now,
            lead: { _id: 'l1', name: 'Couple', cloudPassword: 'private' } }],
        undatedTasks: [{ _id: 't2', title: 'Call client', status: 'pending' }],
        recentLeads: [{ _id: 'l1', name: 'Couple', status: 'New', email: 'private', cloudPassword: 'private' }]
    });
    const overview = buildStudioOverview(data, now);
    assert.deepEqual(overview.summary, { totalEnquiries: 19, openEnquiries: 12, bookedProjects: 5,
        upcomingEvents: 9, pendingTasks: 30, overdueTasks: 12, activeCrew: 4, clientCollections: 8 });
    assert.equal(overview.pipeline.find(stage => stage.status === 'Meeting').count, 0);
    assert.equal(overview.generatedAt, now.toISOString());
    assert.equal(overview.actionQueue[1].dueDate, null);
    assert.equal(overview.actionQueue[0].lead.cloudPassword, undefined);
    assert.equal(overview.recentEnquiries[0].email, undefined);
    assert.equal(overview.upcomingEvents[0].googleEventId, undefined);
});

test('empty overview contains truthful zero metrics; action queue is bounded', () => {
    const data = emptyOverview();
    assert.equal(buildStudioOverview(data).summary.totalEnquiries, 0);
    assert.equal(buildStudioOverview(data).pipeline.length, 6);
    data.datedTasks = Array.from({ length: 8 }, (_, i) => ({ _id: `dated-${i}`, title: 'Due task', status: 'pending' }));
    data.undatedTasks = [{ _id: 'undated', title: 'Later', status: 'pending' }];
    assert.equal(buildStudioOverview(data).actionQueue.length, 8);
    assert.equal(buildStudioOverview(data).actionQueue[0]._id, 'dated-0');
});
