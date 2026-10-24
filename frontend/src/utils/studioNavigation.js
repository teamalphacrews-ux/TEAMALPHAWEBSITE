export function safeStudioReturn(value, fallback = '/admin') {
  if (typeof value !== 'string' || value.length > 500 || /[\\\s]/.test(value) || [...value].some(character => character.charCodeAt(0) < 32) || !/^\/admin(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}

export function recordDestination(kind, id, returnTo = '/admin') {
  const routes = { enquiry: ['/admin/crm', 'lead'], event: ['/admin/calendar', 'event'] };
  const route = routes[kind];
  if (!route) return '/admin';
  if (!id || typeof id !== 'string') return route[0];
  const query = new URLSearchParams({ [route[1]]: id, returnTo: safeStudioReturn(returnTo) });
  return route[0] + '?' + query;
}
