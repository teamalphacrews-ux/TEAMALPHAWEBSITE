const test = require('node:test');
const assert = require('node:assert/strict');
const Notification = require('../models/Notification');
const router = require('../routes/notificationRoutes');

async function handle(method, path, request) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); } };
    await route.stack[0].handle(request, response);
    return response;
}

test('a commercial notification read returns the signed-in member’s current status', async t => {
    const member = '000000000000000000000001';
    const other = '000000000000000000000002';
    const row = new Notification({ title: 'Audit', isRead: false, readBy: [other, member], hiddenBy: [other] });
    t.mock.method(Notification, 'findByIdAndUpdate', async () => row);
    const result = await handle('patch', '/:id/read', { saas: {}, user: { id: member }, params: { id: String(row._id) } });
    assert.equal(result.body.isRead, true);
    assert.equal(Object.hasOwn(result.body, 'readBy'), false);
    assert.equal(Object.hasOwn(result.body, 'hiddenBy'), false);
});

test('marking a missing notification read reports its absence', async t => {
    t.mock.method(Notification, 'findByIdAndUpdate', async () => null);
    const result = await handle('patch', '/:id/read', { user: { id: 'member' }, params: { id: '000000000000000000000001' } });
    assert.equal(result.statusCode, 404);
});

test('new manual notification input cannot set delivery keys or another member’s state', async t => {
    t.mock.method(Notification.prototype, 'save', async function () { return this; });
    const body = { title: 'Reminder', description: 'Due today', type: 'Task', link: '/admin/tasks', readBy: ['000000000000000000000001'], eventKey: 'reserved', isRead: true };
    const result = await handle('post', '/create', { body, saas: {}, user: { id: '000000000000000000000001' } });
    assert.equal(result.body.isRead, false);
    assert.equal(result.body.eventKey, undefined);
    assert.equal(result.body.readBy, undefined);
    assert.equal(result.body.title, body.title);
});
