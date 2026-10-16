const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createSocketAuth, canJoinRoom, registerStudioSockets } = require('../realtime/studioSocket');

const clientId = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const messageId = '507f1f77bcf86cd799439013';
const secret = 'test-only-socket-jwt-secret';

test('socket authentication requires valid JWT and loads the current database role', async () => {
    let lookups = 0;
    const User = { findById(id) { lookups++; assert.equal(id, clientId); return { select: async () => ({ _id: id, role: 'client' }) }; } };
    const authenticate = createSocketAuth({ User, getSecret: () => secret, systemAdminEnabled: () => false });
    const missing = { handshake: { auth: {} } };
    let failure;
    await authenticate(missing, error => { failure = error; });
    assert.ok(failure instanceof Error);
    assert.equal(lookups, 0);
    const socket = { handshake: { auth: { token: jwt.sign({ user: { id: clientId, role: 'admin' } }, secret) } } };
    await authenticate(socket, error => { failure = error; });
    assert.equal(failure, undefined);
    assert.deepEqual(socket.user, { id: clientId, role: 'client' });
    assert.equal(lookups, 1);
    const invalid = { handshake: { auth: { token: 'bad' } } };
    await authenticate(invalid, error => { failure = error; });
    assert.ok(failure instanceof Error);
});

test('clients can only join their own room; admins can join studio and client rooms', () => {
    assert.equal(canJoinRoom({ id: clientId, role: 'client' }, clientId), true);
    assert.equal(canJoinRoom({ id: clientId, role: 'client' }, otherId), false);
    assert.equal(canJoinRoom({ id: clientId, role: 'client' }, 'admin'), false);
    assert.equal(canJoinRoom({ id: 'hardcoded-admin-id', role: 'admin' }, 'admin'), true);
    assert.equal(canJoinRoom({ id: 'hardcoded-admin-id', role: 'admin' }, clientId), true);
    assert.equal(canJoinRoom({ id: 'hardcoded-admin-id', role: 'admin' }, '../anything'), false);
});

function harness() {
    const handlers = {};
    const joined = [];
    const emitted = [];
    const emitChain = () => ({ to() { return this; }, emit(event, data) { emitted.push({ event, data }); } });
    const socket = { id: 'test-socket', user: { id: clientId, role: 'client' },
        join: room => joined.push(room), on: (event, callback) => { handlers[event] = callback; },
        to: () => emitChain() };
    const io = { use() {}, on(event, callback) { if (event === 'connection') callback(socket); }, to: () => emitChain() };
    return { socket, io, handlers, joined, emitted };
}

test('socket read and delivery events cannot mutate another client conversation', async () => {
    const state = harness();
    const writes = [];
    let message = { _id: messageId, sender: 'admin', recipient: otherId, status: 'sent' };
    const User = { find: async () => [] };
    const Message = {
        findById: async () => message,
        findOneAndUpdate: async (filter, update) => { writes.push({ filter, update }); return { ...message, status: 'delivered' }; },
        updateMany: async (filter, update) => { writes.push({ filter, update }); }
    };
    const ChatRoom = { findOneAndUpdate: async () => {}, findOne: async () => ({ unreadCountUser: 0, unreadCountAdmin: 2 }) };
    const onlineUsers = new Map();
    registerStudioSockets(state.io, { User, Message, ChatRoom, onlineUsers });
    assert.deepEqual(state.joined, [clientId]);
    await state.handlers.join_chat('admin');
    await state.handlers.join_chat(otherId);
    assert.deepEqual(state.joined, [clientId]);
    await state.handlers.message_delivered({ messageId, senderId: 'spoofed' });
    assert.equal(writes.length, 0);
    message = { ...message, recipient: clientId };
    await state.handlers.message_delivered({ messageId, senderId: 'spoofed' });
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0].filter, { _id: messageId, status: 'sent' });
    await state.handlers.mark_read({ roomId: otherId, readerType: 'admin' });
    assert.equal(writes[1].filter.recipient, clientId);
    assert.equal(writes[1].filter.sender.$in.includes('admin'), true);
    assert.equal(writes[1].filter.sender.$in.includes(otherId), false);
    assert.equal(onlineUsers.get(clientId).size, 1);
    state.handlers.disconnect();
    assert.equal(onlineUsers.has(clientId), false);
});
