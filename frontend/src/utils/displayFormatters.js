// Cache display conventions only. Dates, amounts and rendered labels stay with the caller.
function cachedFormatter(Formatter) {
  const formats = new Map();
  return (locale, options) => {
    const key = JSON.stringify([locale, options]);
    const existing = formats.get(key);
    if (existing) return existing;
    const formatter = new Formatter(locale, options);
    if (formats.size >= 32) formats.delete(formats.keys().next().value);
    formats.set(key, formatter);
    return formatter;
  };
}

export const displayDateTime = cachedFormatter(Intl.DateTimeFormat);
export const displayNumber = cachedFormatter(Intl.NumberFormat);
