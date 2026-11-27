// Business notes and messages can contain client links as plain text.
function sanitizeArchiveText(value) {
  const text = value.replace(/(\/(?:quote|invoice)\/)[a-f\d.]{24,100}/gi, '$1[link removed]');
  if (!/^https?:\/\//i.test(text)) return text;
  try {
    const url = new URL(text);
    let changed = Boolean(url.username || url.password);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|credential|authorization|api[_-]?key|signature/i.test(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return url.href;
  } catch { /* Ordinary business text is kept as plain text. */ }
  return text;
}

module.exports = { sanitizeArchiveText };
