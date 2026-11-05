const DEFAULT_STUDIO_TIMEZONE = 'Asia/Kolkata';
const formatters = new Map();

function dayFormatter(timezone) {
    const key = typeof timezone === 'string' && timezone ? timezone : DEFAULT_STUDIO_TIMEZONE;
    if (formatters.has(key)) return formatters.get(key);
    let formatter;
    try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: key, year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch { return dayFormatter(DEFAULT_STUDIO_TIMEZONE); }
    formatters.set(key, formatter);
    return formatter;
}

// Task due dates represent calendar days. Find the first instant of the studio's
// current day, including zones whose offset changes at or near midnight.
function studioDayStart(value = new Date(), timezone = DEFAULT_STUDIO_TIMEZONE) {
    const instant = new Date(value).getTime();
    if (!Number.isFinite(instant)) throw new TypeError('Choose a valid date for the studio day.');
    const formatter = dayFormatter(timezone);
    const keyAt = milliseconds => {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map(part => [part.type, part.value]));
        return `${parts.year}-${parts.month}-${parts.day}`;
    };
    const today = keyAt(instant);
    let low = instant - 36 * 60 * 60 * 1000, high = instant;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (keyAt(middle) < today) low = middle + 1;
        else high = middle;
    }
    return new Date(low);
}

module.exports = { DEFAULT_STUDIO_TIMEZONE, studioDayStart };
