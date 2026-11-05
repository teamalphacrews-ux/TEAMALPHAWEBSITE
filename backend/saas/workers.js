const context = () => require('./tenantContext');

async function forEachWorkspace(job, {
  Workspace,
  env = process.env,
  logger = console,
  runInWorkspace = (...args) => context().runInWorkspace(...args),
} = {}) {
  if (typeof job !== 'function') throw new TypeError('A workspace job function is required.');
  const outcomes = [];
  const run = async workspace => {
    const workspaceId = workspace ? String(workspace._id) : 'legacy';
    try {
      await runInWorkspace(workspace, () => job(workspace));
      outcomes.push({ workspaceId, ok: true });
    } catch {
      // Errors may contain credentials or client data; record only job scope.
      logger.error?.('Studio background job failed.', { workspaceId });
      outcomes.push({ workspaceId, ok: false });
    }
  };

  await run(null);
  if (env.SAAS_ENABLED !== 'true') return outcomes;

  let workspaces;
  try {
    const Registry = Workspace || require('mongoose').connection.model('SaaSWorkspace');
    workspaces = await Registry.find({ state: 'active' });
  } catch {
    logger.error?.('Studio workspace registry is unavailable for background jobs.');
    outcomes.push({ workspaceId: 'registry', ok: false });
    return outcomes;
  }
  const visited = new Set();
  for (const workspace of workspaces) {
    const id = String(workspace?._id || '');
    // Provisioning state, rather than trial/billing status, controls readiness.
    if (workspace?.state !== 'active' || !/^[a-f0-9]{24}$/.test(id) || workspace.databaseName !== `studio_${id}` || visited.has(id)) continue;
    visited.add(id);
    await run(workspace);
  }
  return outcomes;
}

module.exports = { forEachWorkspace };
