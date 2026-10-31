const { currentWorkspace, runInWorkspace } = require('./tenantContext');
const { resolveSession } = require('./access');
function createWorkspaceRealtime(io) {
  const initialized = new Set();
  function ensureWorkspace(workspace) {
    const name = '/studio-' + String(workspace._id);
    const namespace = io.of(name);
    if (initialized.has(name)) return namespace;
    initialized.add(name);
    namespace.use(async (socket, next) => {
      try {
        const token = socket.handshake?.auth?.token;
        const session = await resolveSession(token);
        if (!session || String(session.workspace._id) !== String(workspace._id)) throw new Error('Workspace access denied');
        const verify = async () => {
          const current = await resolveSession(token);
          if (!current || String(current.workspace._id) !== String(workspace._id)) throw new Error('Workspace access ended');
          await runInWorkspace(current.workspace, async () => {
            const user = await require('../models/User').findById(current.membership.localUserId).select('+sessionVersion');
            if (!user) throw new Error('Workspace account unavailable');
            const row = await require('../services/studioSecurity').createSessionVerifier()({ token, decoded: current.decoded, user, touch: false });
            socket.sessionId = String(row._id); socket.user = { id: String(user._id) };
          });
        };
        await verify(); socket.verifyWorkspace = verify; next();
      } catch { next(new Error('Workspace authentication required')); }
    });
    namespace.on('connection', socket => {
      socket.join('admin'); socket.join(socket.user.id);
      // Operational events are server-to-client. Legacy chat commands are not enabled here.
      const timer = setInterval(() => socket.verifyWorkspace().catch(() => socket.disconnect(true)), 30000); timer.unref?.();
      socket.on('disconnect', () => clearInterval(timer));
    });
    return namespace;
  }
  const scoped = new Proxy(io, { get(target, key) {
    const workspace = currentWorkspace(), selected = workspace ? ensureWorkspace(workspace) : target;
    if (key === 'sockets' && workspace) return { sockets: selected.sockets };
    const value = Reflect.get(selected, key, selected);
    return typeof value === 'function' ? value.bind(selected) : value;
  } });
  return { scoped, ensureWorkspace };
}
module.exports = { createWorkspaceRealtime };
