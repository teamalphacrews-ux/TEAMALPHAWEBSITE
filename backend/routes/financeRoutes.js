const { deletableInvoiceFilter } = require('../utils/invoiceDeletion');
const express = require('express');
const Finance = require('../models/Finance');
const Invoice = require('../models/Invoice');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(auth, requireAdmin);

const {
    reportOptions, periods, reportableInvoice, invoiceBalance, bookingBalance, ledgerBalance, toPaise,
} = require('../utils/legacyFinanceReport');

const books = {
    invoices: { Model: Invoice, filter: reportableInvoice, balance: invoiceBalance, fields: 'total advancePaid status' },
    bookings: {
        Model: Lead, filter: { paymentStatus: { $in: ['Unpaid', 'Deposit Paid', 'Paid'] } },
        balance: bookingBalance, fields: 'paymentStatus totalAmount depositAmount',
    },
    ledger: { Model: Finance, filter: { type: 'income' }, balance: ledgerBalance, fields: 'amount status' },
};
const expenseFilter = { type: 'expense', status: 'Paid' };

function reportError(err, res) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Unable to load the finance report.' });
}

async function report(req, monthly) {
    const options = reportOptions(req.query);
    const { source, dateBasis, dateField, timezone, year } = options;
    const windows = periods(options, monthly);
    const dateRange = { $gte: windows[0].start, $lt: windows.at(-1).end };
    const book = books[source];
    const [entries, expenses] = await Promise.all([
        book.Model.find({ ...book.filter, [dateField]: dateRange }).select(book.fields + ' ' + dateField).lean(),
        Finance.find({ ...expenseFilter, date: dateRange }).select('amount date').lean(),
    ]);

    const totals = windows.map(window => ({ ...window, paid: 0, pending: 0, expenses: 0 }));
    function groupFor(date) {
        const time = new Date(date).getTime();
        return totals.find(window => time >= window.start.getTime() && time < window.end.getTime());
    }
    for (const entry of entries) {
        const bucket = groupFor(entry[dateField]);
        if (!bucket) continue;
        const balance = book.balance(entry);
        bucket.paid += balance.paid;
        bucket.pending += balance.pending;
    }
    for (const expense of expenses) {
        const bucket = groupFor(expense.date);
        if (bucket) bucket.expenses += toPaise(expense.amount);
    }

    const metadata = { source, dateBasis, timezone };
    if (monthly) return totals.map(bucket => ({
        ...metadata, name: bucket.name, month: bucket.month, year: bucket.year,
        revenue: bucket.paid / 100, expenses: bucket.expenses / 100,
        // Document dates can group outstanding balances, but cannot date a cash receipt.
        cashFlow: source === 'ledger' ? (bucket.paid - bucket.expenses) / 100 : null,
    }));
    const [total] = totals;
    return {
        ...metadata, year,
        annualSales: total.paid / 100,
        annualProfit: source === 'ledger' ? (total.paid - total.expenses) / 100 : null,
        expenses: total.expenses / 100,
        pendingRevenue: total.pending / 100,
    };
}

router.get('/overview', async (req, res) => {
    try {
        res.json(await report(req, false));
    } catch (err) {
        reportError(err, res);
    }
});

// Get Treasury Allocation (Expenses by Category)
router.get('/allocation', async (req, res) => {
    try {
        const aggregation = await Finance.aggregate([
            { $match: { type: 'expense' } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } }
        ]);

        const allCategories = ['Operational', 'Equipment', 'Travel', 'Marketing', 'Salary', 'Invoice Payment'];
        const totals = new Map(allCategories.map(category => [category, 0]));
        for (const item of aggregation) {
            const category = item._id || 'General';
            totals.set(category, (totals.get(category) || 0) + toPaise(item.total));
        }
        const totalExpenses = [...totals.values()].reduce((sum, amount) => sum + amount, 0);

        const formatted = [...totals].map(([cat, value]) => {
            return {
                label: cat,
                value: value / 100,
                progress: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0,
                color: getColorForCategory(cat)
            };
        });

        // Sort by value desc so biggest are first
        formatted.sort((a, b) => b.value - a.value);

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function getColorForCategory(category) {
    const map = {
        'Equipment': 'bg-emerald-600',
        'Travel': 'bg-blue-600',
        'Marketing': 'bg-amber-500',
        'Operational': 'bg-slate-500',
        'Salary': 'bg-rose-500',
        'Invoice Payment': 'bg-purple-600'
    };
    return Object.hasOwn(map, category) ? map[category] : 'bg-gray-400';
}

// Add Generic Finance Entry
router.post('/', async (req, res) => {
    try {
        const { type, amount, category, description, date, status, studioProjectId } = req.body;
        if (studioProjectId && !await require('../models/StudioProject').exists({ _id: studioProjectId })) {
            return res.status(400).json({ error: 'Select an existing studio project.' });
        }
        const entry = new Finance({ type, amount, category, description, date, status, studioProjectId });
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

function incomeRow(row, source, dateField) {
    const { paid, pending, total } = books[source].balance(row);
    return {
        id: row._id,
        name: row.clientName || row.name || row.description || row.category || 'Income',
        category: row.category || (source === 'invoices' ? 'Invoice Payment' : 'Client Payment'),
        incomeType: { invoices: 'Invoice', bookings: 'Lead', ledger: 'Ledger' }[source],
        status: row.paymentStatus || row.status || 'Pending',
        total: total / 100,
        paid: paid / 100,
        pending: pending / 100,
        date: row[dateField],
    };
}

const byNewest = (a, b) => new Date(b.date) - new Date(a.date);

function listDateFilter(options, dateField) {
    if (!options.explicitYear) return {};
    const [{ start, end }] = periods(options, false);
    return { [dateField]: { $gte: start, $lt: end } };
}

router.get('/transactions', async (req, res) => {
    try {
        const options = reportOptions(req.query);
        const { source, dateField } = options;
        const book = books[source];
        const incomeFilter = source === 'bookings'
            ? { paymentStatus: { $in: ['Deposit Paid', 'Paid'] } }
            : book.filter;
        const [income, expenses] = await Promise.all([
            book.Model.find({ ...incomeFilter, ...listDateFilter(options, dateField) }).sort({ [dateField]: -1 }).limit(10).lean(),
            Finance.find({ type: 'expense', ...listDateFilter(options, 'date') }).sort({ date: -1 }).limit(10).lean(),
        ]);
        const transactions = income.map(record => {
            const row = incomeRow(record, source, dateField);
            return { ...row, amount: row.paid, pendingAmount: row.pending, type: 'income' };
        });
        transactions.push(...expenses.map(expense => ({
            id: expense._id,
            name: expense.category || 'Expense',
            category: expense.description || 'Operational Expense',
            amount: expense.amount || 0,
            date: expense.date,
            type: 'expense',
            status: expense.status || 'Paid',
        })));
        res.json(transactions.sort(byNewest).slice(0, 10));
    } catch (err) {
        reportError(err, res);
    }
});

async function notifyExpense(notification) {
    try {
        await Notification.create(notification);
    } catch {
        console.warn('An expense was saved, but its activity notification could not be recorded.');
    }
}

function expenseError(err, res) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'The expense could not be saved.' });
}

// Add New Expense
router.post('/expense', async (req, res) => {
    try {
        const { title, amount, category, date, status } = req.body;

        // Validation
        if (!title || !amount) {
            return res.status(400).json({ error: "Title and amount are required" });
        }
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }

        const entry = new Finance({
            type: 'expense',
            amount,
            category: category,
            description: title,
            date: date || new Date(),
            status: status || 'Paid'
        });
        await entry.save();

        await notifyExpense({
            title: "Expense Logged",
            description: `New ${category || 'General'} expense of ₹${amount} for "${title}".`,
            type: "Finance"
        });

        res.json(entry);
    } catch (err) {
        expenseError(err, res);
    }
});

// Update Expense
router.put('/expense/:id', async (req, res) => {
    try {
        const { title, amount, category, date, status } = req.body;
        // PRESERVE EXISTING VALUES: Only overwrite changed fields
        const updateFields = {};
        if (category) updateFields.category = category;
        if (Object.hasOwn(req.body, 'amount')) updateFields.amount = amount;
        if (title) updateFields.description = title;
        if (date) updateFields.date = date;
        if (status) updateFields.status = status;

        const updated = await Finance.findOneAndUpdate(
            { _id: req.params.id, type: 'expense' },
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updated) return res.status(404).json({ error: 'Expense not found' });
        await notifyExpense({
            title: "Finance Record Modified",
            description: `Updated ${updated.category} entry: "${updated.description}" (₹${updated.amount}).`,
            type: "Finance"
        });

        res.json(updated);
    } catch (err) {
        expenseError(err, res);
    }
});

// Delete Expense
router.delete('/expense/:id', async (req, res) => {
    try {
        const deleted = await require('../services/studioRecovery').recoverableDelete({ Model: Finance, filter: { _id: req.params.id, type: 'expense' }, actorId: req.user.id });
        if (!deleted) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: "Expense deleted" });
    } catch (err) {
        res.status(err.status || 503).json({ error: err.status ? err.message : 'The expense could not be removed.' });
    }
});

// Safe Deletion for Income (Handled via Lead Payment resetting or Invoice deletion)
router.delete('/income/:incomeType/:id', async (req, res) => {
    try {
        await require('../services/studioSecurity').assertPermission(req.user.id, 'deletion');
        const { incomeType, id } = req.params;

        if (incomeType === 'Lead') {
            const updatedLead = await Lead.findByIdAndUpdate(
                id,
                { paymentStatus: 'Unpaid', depositAmount: 0 },
                { new: true }
            );
            if (!updatedLead) return res.status(404).json({ error: 'Lead not found' });
            return res.json({ message: 'Lead payment reset to unpaid', updatedLead });
        }

        if (incomeType === 'Invoice') {
            const current = await Invoice.findById(id);
            if (!current) return res.status(404).json({ error: 'Invoice not found' });
            const deletedInvoice = await require('../services/studioRecovery').recoverableDelete({ Model: Invoice, filter: deletableInvoiceFilter(id), actorId: req.user.id });
            if (!deletedInvoice) return res.status(409).json({ error: 'Only an unissued, unshared draft without payments or a source quotation can be deleted.' });
            return res.json({ message: 'Invoice deleted successfully' });
        }

        return res.status(400).json({ error: 'Invalid income type' });
    } catch (err) {
        res.status(err.status || 503).json({ error: err.status ? err.message : 'The income record could not be removed.' });
    }
});

router.get('/pending-payments', async (req, res) => {
    try {
        const options = reportOptions(req.query);
        const { source, dateField } = options;
        const book = books[source];
        const unsettled = {
            invoices: { status: { $nin: ['Paid', 'Cancelled'] } },
            bookings: { paymentStatus: { $in: ['Unpaid', 'Deposit Paid'] } },
            ledger: { status: 'Pending' },
        };
        const rows = await book.Model.find({
            ...book.filter, ...unsettled[source], ...listDateFilter(options, dateField),
        }).sort({ [dateField]: -1 }).lean();
        const payments = rows.map(row => {
            const value = incomeRow(row, source, dateField);
            return {
                ...value,
                type: value.incomeType,
                status: source === 'invoices' ? (value.paid ? 'Part paid' : 'Unpaid') : value.status,
            };
        }).filter(row => row.pending > 0);
        res.json(payments);
    } catch (err) {
        reportError(err, res);
    }
});

router.get('/monthly-performance', async (req, res) => {
    try {
        res.json(await report(req, true));
    } catch (err) {
        reportError(err, res);
    }
});

module.exports = router;
