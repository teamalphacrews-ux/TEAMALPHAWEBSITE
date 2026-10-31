const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
function validTimezone(value) {
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0)); return typeof value === 'string' && Boolean(value); }
    catch { return false; }
}
function dateStart(day, timezone) {
    if (!validDay(day) || !validTimezone(timezone)) throw new RangeError('Choose valid calendar dates and timezone.');
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const keyAt = time => { const parts = Object.fromEntries(formatter.formatToParts(time).map(p => [p.type, p.value])); return parts.year + '-' + parts.month + '-' + parts.day; };
    const middle = Date.parse(day + 'T00:00:00Z');
    let low = middle - 36 * 3600000, high = middle + 36 * 3600000;
    while (low < high) { const point = Math.floor((low + high) / 2); if (keyAt(point) < day) low = point + 1; else high = point; }
    if (keyAt(low) !== day) throw new RangeError('This calendar day does not exist in the selected timezone.');
    return new Date(low);
}
function googleDateRange(event, timezone = 'Asia/Kolkata') {
    if (event.start?.date && event.end?.date) {
        const startDate = event.start.date, endDateExclusive = event.end.date;
        if (!validDay(startDate) || !validDay(endDateExclusive) || endDateExclusive <= startDate) throw new RangeError('Google returned an invalid all-day range.');
        const dateTimezone = validTimezone(timezone) ? timezone : 'Asia/Kolkata';
        return { allDay: true, startDate, endDateExclusive, dateTimezone, start: dateStart(startDate, dateTimezone), end: dateStart(endDateExclusive, dateTimezone) };
    }
    const start = new Date(event.start?.dateTime), end = new Date(event.end?.dateTime);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new RangeError('Google returned invalid event times.');
    return { allDay: false, startDate: '', endDateExclusive: '', dateTimezone: '', start, end };
}
function googleEventTimes(event) {
    if (event.allDay === true && validDay(event.startDate) && validDay(event.endDateExclusive) && event.endDateExclusive > event.startDate) {
        return { start: { date: event.startDate }, end: { date: event.endDateExclusive } };
    }
    return { start: { dateTime: new Date(event.start).toISOString(), timeZone: 'UTC' }, end: { dateTime: new Date(event.end).toISOString(), timeZone: 'UTC' } };
}
module.exports = { validDay, validTimezone, dateStart, googleDateRange, googleEventTimes };
