export const NOTIFICATION_CATEGORIES = [
  { id: 'enquiries', label: 'Enquiries', description: 'New enquiries and client updates.' },
  { id: 'calendar', label: 'Calendar & crew', description: 'Events, meetings and assignments.' },
  { id: 'tasks', label: 'Production & tasks', description: 'Delivery updates and task deadlines.' },
  { id: 'finance', label: 'Quotes & payments', description: 'Quotations, invoices and payments.' },
  { id: 'messages', label: 'Client messages', description: 'New client support conversations.' },
  { id: 'system', label: 'Studio updates', description: 'General activity and studio briefings.' },
];
export const NOTIFICATION_TONES = [
  { value: 'chime', label: 'Chime', notes: [660, 880], spacing: .13, duration: .38 },
  { value: 'soft', label: 'Soft', notes: [440, 550], spacing: .09, duration: .3 },
  { value: 'bell', label: 'Bell', notes: [880, 1174], spacing: .06, duration: .55 },
];
const categoriesByType = { Lead: 'enquiries', Event: 'calendar', Task: 'tasks', Gallery: 'tasks', Finance: 'finance', Invoice: 'finance', Chat: 'messages', Message: 'messages', System: 'system' };
export const notificationCategory = item => {
  // Older producers use System for quote and client-support activity. Their
  // existing internal destination still identifies the correct preference.
  if (item?.type === 'System') {
    if (/^\/admin\/(quotations|invoices|finance)(?:[/?#]|$)/.test(item.link || '')) return 'finance';
    if (/^\/admin\/(chats|email|whatsapp)(?:[/?#]|$)/.test(item.link || '')) return 'messages';
  }
  return categoriesByType[item?.type] || 'system';
};
export const notificationIsSelected = (item, preferences = {}) => !Array.isArray(preferences.notificationCategories) || preferences.notificationCategories.includes(notificationCategory(item));
export const notificationVolume = value => Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
const minutes = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  return match && +match[1] < 24 && +match[2] < 60 ? +match[1] * 60 + +match[2] : null;
};
export function notificationTimezone(preferences = {}, studioZone = 'Asia/Kolkata') {
  const zone = preferences.timezone && preferences.timezone !== 'studio' ? preferences.timezone : studioZone;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone; }
  catch { return 'Asia/Kolkata'; }
}
export function notificationQuietNow(preferences = {}, now = new Date(), studioZone) {
  if (!preferences.quietHoursEnabled) return false;
  const start = minutes(preferences.quietHoursStart), end = minutes(preferences.quietHoursEnd);
  if (start === null || end === null || !Number.isFinite(new Date(now).getTime())) return false;
  // Identical times intentionally mean a full day of quiet hours.
  if (start === end) return true;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: notificationTimezone(preferences, studioZone), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const current = Number(parts.find(part => part.type === 'hour').value) * 60 + Number(parts.find(part => part.type === 'minute').value);
  return start < end ? current >= start && current < end : current >= start || current < end;
}
export function notificationAlertAllowed(item, preferences = {}, now, studioZone) {
  return !!item?._id && !item.isRead && notificationIsSelected(item, preferences) && !notificationQuietNow(preferences, now, studioZone);
}
export function collectNewNotifications(items, previouslySeen) {
  const rows = Array.isArray(items) ? items : [];
  const unique = new Map(rows.filter(item => item && typeof item._id === 'string').map(item => [item._id, item]));
  return { fresh: previouslySeen ? [...unique.values()].filter(item => !previouslySeen.has(item._id) && !item.isRead) : [], seen: new Set([...(previouslySeen || []), ...unique.keys()].slice(-500)) };
}

// One short sound per batch. No media downloads or third-party sound services.
let audioContext;
export async function prepareNotificationAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext.state === 'running';
  } catch { return false; }
}
export async function playNotificationSound(tone = 'chime', volume = 50, { userGesture = false } = {}) {
  const level = notificationVolume(volume);
  if (!level) return false;
  if (userGesture && !await prepareNotificationAudio()) return false;
  if (!audioContext || audioContext.state !== 'running') return false;
  try {
    const selected = NOTIFICATION_TONES.find(item => item.value === tone) || NOTIFICATION_TONES[0];
    selected.notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const start = audioContext.currentTime + index * selected.spacing;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level / 100 * .12, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + selected.duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + selected.duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
    return true;
  } catch { return false; }
}

// Share only notification IDs across local tabs. The lock avoids simultaneous
// polling tabs both displaying the same alert when Web Locks are available.
export async function claimNotificationAlerts(accountId, items) {
  const key = 'teamalpha-notification-alerts:' + accountId;
  const claim = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const seen = new Set(Array.isArray(stored) ? stored : []);
      const fresh = items.filter(item => !seen.has(item._id));
      localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map(item => item._id)].slice(-500)));
      return fresh;
    } catch { return items; }
  };
  if (!navigator.locks?.request) return claim();
  try { return await navigator.locks.request(key, claim); }
  catch { return claim(); }
}
