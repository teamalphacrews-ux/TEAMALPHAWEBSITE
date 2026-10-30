const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();
const invalidContext = () => Object.assign(new Error('A valid studio workspace is required.'), {
  status: 403,
  code: 'WORKSPACE_CONTEXT_INVALID',
});

function workspaceDatabase(workspaceId) {
  const id = typeof workspaceId === 'string' ? workspaceId : workspaceId?.toHexString?.();
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw invalidContext();
  return 'studio_' + id.toLowerCase();
}

function validatedWorkspace(workspace) {
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) throw invalidContext();
  const record = typeof workspace.toObject === 'function' ? workspace.toObject() : workspace;
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw invalidContext();
  const databaseName = workspaceDatabase(record._id);
  if (record.databaseName !== databaseName) throw invalidContext();
  // Copy the server-owned identity so it cannot be retargeted in-flight.
  return Object.freeze({ ...record, _id: databaseName.slice(7), databaseName });
}

function runInWorkspace(workspace, fn) {
  if (typeof fn !== 'function') throw new TypeError('Workspace work must be a function.');
  // Explicit null resets context for the legacy installation, including when a
  // worker is currently processing a different workspace.
  return storage.run(workspace === null ? null : validatedWorkspace(workspace), fn);
}

function currentWorkspace() { return storage.getStore() || null; }

module.exports = { runInWorkspace, currentWorkspace, workspaceDatabase };
