// Recovery replaces business records. Never replay an older layout patch or
// restore a device draft created against the previous generation of records.
export async function reconcileWorkspaceDataEpoch(user, { storage, purgeDrafts, scope } = {}) {
  const id = String(user?._id || user?.id || '');
  if (!id || user?.isPreview === true) return;
  const version = Number.isSafeInteger(user.workspaceDataVersion) && user.workspaceDataVersion >= 0 ? user.workspaceDataVersion : 0;
  const key = 'studio-data-epoch:' + id;
  const old = storage.getItem(key);
  if ((old !== null && Number(old) !== version) || (old === null && version > 0)) {
    if (scope) await purgeDrafts(scope);
    const prefix = 'teamalpha-studio-preferences:' + id;
    for (let index = storage.length - 1; index >= 0; index--) {
      const name = storage.key(index);
      if (name === prefix || name?.startsWith(prefix + ':')) storage.removeItem(name);
    }
  }
  storage.setItem(key, String(version));
}
