const { dateStart } = require('./calendarDateRange');
const { DEFAULT_STUDIO_TIMEZONE: timezone } = require('./studioDay');

const sources = {
    invoices: { dateField: 'invoiceDate', dateBasis: 'invoice_date' },
    bookings: { dateField: 'createdAt', dateBasis: 'booking_created_at' },
    ledger: { dateField: 'date', dateBasis: 'ledger_entry_date' },
};

const monthYear = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric' });
const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });
const toPaise = amount => Math.round((amount || 0) * 100);

function reportOptions({ source = 'invoices', year } = {}, now = new Date()) {
    if (typeof source !== 'string' || !Object.hasOwn(sources, source)) {
        throw Object.assign(new Error('Choose invoices, bookings, or ledger.'), { status: 400 });
    }
    if (year !== undefined && (typeof year !== 'string' || !/^[1-9]\d{3}$/.test(year) || Number(year) === 9999)) {
        throw Object.assign(new Error('Choose a four-digit year from 1000 to 9998.'), { status: 400 });
    }
    const current = Object.fromEntries(monthYear.formatToParts(now).map(part => [part.type, Number(part.value)]));
    return {
        source, ...sources[source], timezone, explicitYear: year !== undefined,
        year: year === undefined ? current.year : Number(year),
        currentMonth: current.month,
    };
}

function monthBoundary(year, month) {
    const key = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
    return dateStart(key, timezone);
}

function periods(options, monthly) {
    const { year, currentMonth, explicitYear } = options;
    if (!monthly) return [{
        start: monthBoundary(year, 1),
        end: monthBoundary(year + 1, 1),
    }];
    const firstMonth = explicitYear ? 1 : currentMonth - 5;
    return Array.from({ length: explicitYear ? 12 : 6 }, (_, offset) => {
        const month = firstMonth + offset;
        const utc = new Date(Date.UTC(year, month - 1, 1));
        return {
            start: monthBoundary(year, month),
            end: monthBoundary(year, month + 1),
            name: monthName.format(utc),
            year: utc.getUTCFullYear(),
            month: utc.getUTCMonth() + 1,
        };
    });
}

const reportableInvoice = {
    documentStatus: { $nin: ['Draft', 'Cancelled', 'Archived'] },
    status: { $ne: 'Cancelled' },
    currency: { $in: [null, '', 'INR'] },
};

function paymentBalance(totalAmount, paidAmount, paidInFull) {
    const total = Math.max(0, toPaise(totalAmount));
    const paid = paidInFull ? total : Math.min(total, Math.max(0, toPaise(paidAmount)));
    return { total, paid, pending: total - paid };
}

const invoiceBalance = invoice => paymentBalance(invoice.total, invoice.advancePaid, invoice.status === 'Paid');
const bookingBalance = booking => paymentBalance(
    booking.totalAmount, booking.paymentStatus === 'Deposit Paid' ? booking.depositAmount : 0, booking.paymentStatus === 'Paid',
);
const ledgerBalance = entry => paymentBalance(entry.amount, 0, entry.status === 'Received' || entry.status === 'Paid');

module.exports = { reportOptions, periods, reportableInvoice, invoiceBalance, bookingBalance, ledgerBalance, toPaise };
