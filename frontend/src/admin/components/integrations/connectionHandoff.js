// Accept only the server's one-use Drive handoff, never an arbitrary redirect.
export function driveConnectionHandoff(result, apiBase, pageOrigin) {
  const failure = () => new Error('Google Drive connection could not be opened. Please try again.');
  if (typeof result?.url !== 'string' || result.url.length > 2048) throw failure();
  let target, api, page;
  try { target = new URL(result.url); api = new URL(apiBase || pageOrigin, pageOrigin); page = new URL(pageOrigin); } catch { throw failure(); }
  const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const localProxy = local(target) && local(api) && local(page);
  if ((!localProxy && target.origin !== api.origin) || target.pathname !== '/api/integrations/drive-backups/begin' ||
    target.username || target.password || target.hash || (target.protocol !== 'https:' && !(target.protocol === 'http:' && local(target))) ||
    [...target.searchParams.keys()].length !== 1 || !/^[a-f0-9]{64}$/.test(target.searchParams.get('ticket') || '')) throw failure();
  return target.href;
}
