// Capability URLs come from the server's configured public website origin.
export function documentClientLink(value, kind = 'quote') {
  let url;
  try { url = new URL(value); } catch { throw new Error('The studio did not return an active client link. Please try again.'); }
  const path = kind === 'invoice' ? 'invoice' : 'quote';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      !new RegExp(`^/${path}/(?:[a-f\\d]{24}\\.)?[a-f\\d]{64}$`, 'i').test(url.pathname)) {
    throw new Error('The studio did not return a valid client link. Please try again.');
  }
  return url.href;
}
