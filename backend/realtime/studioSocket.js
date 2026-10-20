const jwt = require('jsonwebtoken');

const isAdmin = user => user.role === 'admin';
const validRoomId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const canJoinRoom = (user, roomId) => roomId === user.id || (isAdmin(user) && (roomId === 'admin' || validRoomId(roomId)));

function createSocketAuth({ User, getSecret = () => process.env.JWT_SECRET }) {
    return async (socket, next) => {
        try {
            const token = socket.handshake?.auth?.token;
            if (typeof token !== 'string' || !token) return next(new Error('Authentication required'));
            const decoded = jwt.verify(token, getSecret());
            if (!decoded.user || typeof decoded.user.id !== 'string') return next(new Error('Invalid authentication'));
            if (!validRoomId(decoded.user.id)) return next(new Error('Invalid authentication'));
            const user = await User.findById(decoded.user.id).select('_id role');
            if (!user) return next(new Error('Invalid authentication'));
            // Read the current database role so revoked access takes effect on reconnect.
            socket.user = { id: String(user._id), role: user.role };
            return next();
        } catch {
            return next(new Error('Invalid authentication'));
        }
    };
}

function registerStudioSockets(io, { User, Message, ChatRoom, onlineUsers }) {
    io.use(createSocketAuth({ User }));
    const adminIds = async () => ['admin', 'hardcoded-admin-id', ...(await User.find({ role: 'admin' }, '_id')).map(user => String(user._id))];
    const emitRoomUpdate = (roomId, room) => io.to('admin').to(roomId).emit('room_updated', {
        roomId, unreadCountAdmin: room?.unreadCountAdmin || 0, unreadCountUser: room?.unreadCountUser || 0
    });

    io.on('connection', socket => {
        const user = socket.user;
        const aliases = isAdmin(user) ? [user.id, 'admin'] : [user.id];
        for (const roomId of aliases) {
            socket.join(roomId);
            if (!onlineUsers.has(roomId)) onlineUsers.set(roomId, new Set());
            onlineUsers.get(roomId).add(socket.id);
            io.to('admin').to(user.id).emit('user_online', { userId: roomId });
        }

        socket.on('join_chat', roomId => {
            if (canJoinRoom(user, roomId)) socket.join(roomId);
        });

        for (const [event, output] of [['typing_start', 'display_typing'], ['typing_stop', 'hide_typing']]) {
            socket.on(event, (data = {}) => {
                const roomId = isAdmin(user) ? data.roomId : user.id;
                if (!canJoinRoom(user, roomId)) return;
                const target = isAdmin(user) ? roomId : 'admin';
                socket.to(target).emit(output, { roomId, senderId: user.id });
            });
        }

        socket.on('message_delivered', async (data = {}) => {
            try {
                if (!validRoomId(data.messageId)) return;
                const message = await Message.findById(data.messageId);
                if (!message) return;
                const recipient = String(message.recipient);
                const recipientAllowed = recipient === user.id || (isAdmin(user) && (await adminIds()).includes(recipient));
                if (!recipientAllowed || message.status !== 'sent') return;
                const updated = await Message.findOneAndUpdate({ _id: message._id, status: 'sent' },
                    { $set: { status: 'delivered' } }, { new: true });
                if (updated) io.to(String(message.sender)).emit('message_status_update', { messageId: message._id, status: 'delivered' });
            } catch (error) { console.error('Socket delivery update failed:', error.name); }
        });

        socket.on('mark_read', async (data = {}) => {
            try {
                const roomId = isAdmin(user) ? data.roomId : user.id;
                if (!canJoinRoom(user, roomId) || roomId === 'admin') return;
                const ids = await adminIds();
                const query = isAdmin(user)
                    ? { sender: roomId, recipient: { $in: ids }, seen: false }
                    : { recipient: user.id, sender: { $in: ids }, seen: false };
                await Message.updateMany(query, { $set: { seen: true, isRead: true, status: 'seen' } });
                const unreadField = isAdmin(user) ? 'unreadCountAdmin' : 'unreadCountUser';
                await ChatRoom.findOneAndUpdate({ userId: roomId }, { $set: { [unreadField]: 0 } });
                const room = await ChatRoom.findOne({ userId: roomId });
                emitRoomUpdate(roomId, room);
                socket.to(roomId).to('admin').emit('chat_seen', { chatId: roomId });
            } catch (error) { console.error('Socket read update failed:', error.name); }
        });

        socket.on('chat_seen', data => {
            const roomId = typeof data === 'string' ? data : data?.chatId;
            if (!canJoinRoom(user, roomId)) return;
            socket.to(roomId).to('admin').emit('chat_seen', { chatId: roomId });
        });

        socket.on('disconnect', () => {
            for (const roomId of aliases) {
                const sockets = onlineUsers.get(roomId);
                sockets?.delete(socket.id);
                if (sockets?.size === 0) {
                    onlineUsers.delete(roomId);
                    io.to('admin').to(user.id).emit('user_offline', { userId: roomId });
                }
            }
        });
    });
}

module.exports = { createSocketAuth, canJoinRoom, registerStudioSockets };
