// Optional iOS capabilities. The website keeps its existing behavior in browsers.
let workspaceGeneration = 0;
export function captureWorkspaceContext() { return workspaceGeneration; }
export function assertWorkspaceContext(context) {
  if (context !== workspaceGeneration) throw new Error('Your studio session changed. Start the download again in the current workspace.');
}
export function nativeWorkspaceAvailable() {
  return typeof window !== 'undefined' && window.StudioOSNative?.available === true && typeof window.StudioOSNative?.saveFile === 'function';
}
export async function saveNativeWorkspaceFile(blob, filename, context = captureWorkspaceContext()) {
  assertWorkspaceContext(context);
  if (!nativeWorkspaceAvailable()) return false;
  await window.StudioOSNative.saveFile(blob, filename);
  return true;
}
export function notifyNativeWorkspaceChanged() {
  workspaceGeneration += 1;
  try { if (typeof window !== 'undefined') window.StudioOSNative?.contextChanged?.(); } catch { /* A platform capability must never prevent sign-out. */ }
}
