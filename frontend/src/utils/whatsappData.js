export const whatsappConnectionLabel = status => !status ? 'Checking connection' : status.state === 'preview' ? 'Preview only' : status.connected === true ? 'Connected' : ({ setup_needed: 'Setup needed', verification_needed: 'Verify connection', coexistence_required: 'App connection needed', unavailable: 'Unavailable' }[status.state] || 'Not connected');

export function internationalWhatsAppPhone(value) {
  if (typeof value !== 'string' || value.length > 35 || !/^\+[\d ()-]+$/.test(value.trim())) return '';
  const phone = value.trim().replace(/[ ()-]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : '';
}

export const openWhatsAppUrl = phone => {
  const value = internationalWhatsAppPhone(phone);
  return value ? 'https://wa.me/' + value.slice(1) : '';
};

export function whatsappReplyWindow(conversation, now = Date.now()) {
  const until = Date.parse(conversation?.windowExpiresAt);
  return Number.isFinite(until) && until > Number(now);
}

export function whatsappMessageStatus(message) {
  if (message.direction === 'inbound') return 'Received';
  return { pending: 'Preparing', sending: 'Sending', accepted: 'Accepted by WhatsApp', submitted: 'Accepted by WhatsApp', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Delivery unconfirmed' }[message.status] || 'Delivery unconfirmed';
}

export const confirmedWhatsAppSubmission = status => ['submitted', 'sent', 'delivered', 'read'].includes(status);

export function approvedTemplateDraft(template, values = []) {
  if (!template || !Number.isInteger(template.parameterCount) || template.parameterCount < 0 || template.parameterCount > 20 || !Array.isArray(values)) return { valid: false, parameters: [], preview: '' };
  const parameters = values.slice(0, template.parameterCount).map(value => typeof value === 'string' ? value.trim() : '');
  const valid = parameters.length === template.parameterCount && parameters.every(value => value.length > 0 && value.length <= 1024);
  const preview = String(template.body || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (original, index) => parameters[Number(index) - 1] || original);
  return { valid, parameters, preview };
}

export function mergeWhatsAppMessages(previous = [], incoming = []) {
  const messages = new Map();
  const rank = { sending: 0, unknown: 0, submitted: 1, accepted: 1, sent: 2, failed: 2.5, delivered: 3, read: 4 };
  for (const message of [...previous, ...incoming]) if (message && typeof message.id === 'string' && message.id) {
    const old = messages.get(message.id);
    const retainStatus = old?.direction === 'outbound' && message.direction === 'outbound' && (rank[old.status] || 0) > (rank[message.status] || 0);
    messages.set(message.id, retainStatus ? { ...message, status: old.status, error: old.error } : message);
  }
  return [...messages.values()].sort((first, second) => (Date.parse(first.createdAt) || 0) - (Date.parse(second.createdAt) || 0) || first.id.localeCompare(second.id)).slice(-500);
}

/** Polling's latest page is authoritative in its range, including canonicalized
 * provider echoes. Keep loaded older history and messages created after the read began. */
export function refreshWhatsAppMessages(previous = [], incoming = [], { hasEarlier = false, requestedAt = Date.now() } = {}) {
  const current = incoming.filter(message => message && typeof message.id === 'string' && message.id);
  const ids = new Set(current.map(message => message.id));
  const dates = current.map(message => Date.parse(message.createdAt)).filter(Number.isFinite);
  const oldest = dates.length ? Math.min(...dates) : Infinity;
  const keep = previous.filter(message => {
    const at = Date.parse(message.createdAt);
    return ids.has(message.id) || !Number.isFinite(at) || at > requestedAt || (hasEarlier && at < oldest);
  });
  return mergeWhatsAppMessages(keep, current);
}

export const whatsappRequestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
