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

const reportableInvoice = {
    documentStatus: { $nin: ['Draft', 'Cancelled', 'Archived'] },
    status: { $ne: 'Cancelled' },
};
const toPaise = amount => Math.round((amount || 0) * 100);
function invoiceBalance(invoice) {
    const total = toPaise(invoice.total);
    const paid = invoice.status === 'Paid' ? total : Math.min(total, Math.max(0, toPaise(invoice.advancePaid)));
    return { total, paid, pending: total - paid };
}

const calculateFinanceStats = async () => {
    const [invoices, leads, expensesData] = await Promise.all([
        Invoice.find(reportableInvoice).select('total advancePaid status').lean(),
        Lead.find({ paymentStatus: { $in: ['Unpaid', 'Deposit Paid', 'Paid'] } }).select('paymentStatus totalAmount depositAmount').lean(),
        Finance.find({ type: 'expense' }).select('amount').lean(),
    ]);
    let received = 0, pending = 0;
    for (const invoice of invoices) {
        const balance = invoiceBalance(invoice);
        received += balance.paid;
        pending += balance.pending;
    }
    for (const lead of leads) {
        const total = toPaise(lead.totalAmount);
        const paid = lead.paymentStatus === 'Paid' ? total : lead.paymentStatus === 'Deposit Paid' ? toPaise(lead.depositAmount) : 0;
        received += paid;
        pending += total - paid;
    }
    const expensePaise = expensesData.reduce((sum, item) => sum + toPaise(item.amount), 0);
    return {
        annualSales: received / 100,
        annualProfit: (received - expensePaise) / 100,
        expenses: expensePaise / 100,
        pendingRevenue: pending / 100,
    };
};

// Get Finance Overview (Stats)
router.get('/overview', async (req, res) => {
    try {
        const stats = await calculateFinanceStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// Get Recent Transactions (Combined Invoices & Expenses)
router.get('/transactions', async (req, res) => {
    try {
        // Fetch last 10 invoices (Paid or Pending)
        const recentInvoices = await Invoice.find(reportableInvoice)
            .sort({ invoiceDate: -1 })
            .limit(10)
            .lean();

        // Fetch last 10 expenses
        const recentExpenses = await Finance.find({ type: 'expense' })
            .sort({ date: -1 })
            .limit(10)
            .lean();

        // Fetch last 10 leads with deposit/paid
        const recentLeads = await Lead.find({ paymentStatus: { $in: ['Deposit Paid', 'Paid'] } })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Combine and sort
        const transactions = [
            ...recentInvoices.map(inv => ({
                id: inv._id,
                name: inv.clientName,
                category: 'Invoice Payment',
                amount: invoiceBalance(inv).paid / 100,
                pendingAmount: invoiceBalance(inv).pending / 100,
                date: inv.invoiceDate,
                type: 'income',
                incomeType: 'Invoice',
                status: inv.status || 'Pending'
            })),
            ...recentExpenses.map(exp => ({
                id: exp._id,
                name: exp.category || 'Expense',
                category: exp.description || 'Operational Expense',
                amount: exp.amount || 0,
                date: exp.date,
                type: 'expense',
                status: exp.status || 'Paid'
            })),
            ...recentLeads.map(lead => ({
                id: lead._id,
                name: lead.name + ' (Lead)',
                category: 'Client Payment',
                amount: lead.paymentStatus === 'Paid' ? (lead.totalAmount || 0) : (lead.paymentStatus === 'Deposit Paid' ? (lead.depositAmount || 0) : 0),
                pendingAmount: lead.paymentStatus === 'Paid' ? 0 : ((lead.totalAmount || 0) - (lead.paymentStatus === 'Deposit Paid' ? (lead.depositAmount || 0) : 0)),
                date: lead.createdAt || new Date(),
                type: 'income',
                incomeType: 'Lead',
                status: lead.paymentStatus
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
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

// Get Payment Plans (Pending Invoices)
router.get('/pending-payments', async (req, res) => {
    try {
        const pendingInvoices = await Invoice.find({ ...reportableInvoice, status: { $nin: ['Paid', 'Cancelled'] } }).sort({ invoiceDate: -1 }).lean();
        const pendingLeads = await Lead.find({ paymentStatus: { $in: ['Unpaid', 'Deposit Paid'] } }).sort({ createdAt: -1 }).lean();

        const formatted = [
            ...pendingInvoices.filter(inv => invoiceBalance(inv).pending > 0).map(inv => ({
                id: inv._id,
                name: inv.clientName,
                type: 'Invoice',
                total: inv.total || 0,
                paid: invoiceBalance(inv).paid / 100,
                pending: invoiceBalance(inv).pending / 100,
                status: invoiceBalance(inv).paid ? 'Part paid' : 'Unpaid',
                date: inv.invoiceDate
            })),
            ...pendingLeads.map(lead => ({
                id: lead._id,
                name: lead.name,
                type: 'Lead',
                total: lead.totalAmount || 0,
                paid: lead.paymentStatus === 'Deposit Paid' ? (lead.depositAmount || 0) : 0,
                pending: (lead.totalAmount || 0) - (lead.paymentStatus === 'Deposit Paid' ? (lead.depositAmount || 0) : 0),
                status: lead.paymentStatus,
                date: lead.createdAt
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Monthly Performance Data (Revenue vs Expenses vs Cash Flow)
router.get('/monthly-performance', async (req, res) => {
    try {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = new Date();
        const performanceData = [];

        // Calculate the range: 6 months ago to now
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Aggregation for Invoices
        const invoiceAgg = await Invoice.aggregate([
            { $match: { ...reportableInvoice, invoiceDate: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: "$invoiceDate" }, year: { $year: "$invoiceDate" } },
                total: { $sum: { $cond: [
                    { $eq: ["$status", "Paid"] }, "$total",
                    { $min: ["$total", { $max: [0, { $ifNull: ["$advancePaid", 0] }] }] },
                ] } }
            }}
        ]);

        // Aggregation for Leads
        const leadAgg = await Lead.aggregate([
            { $match: { paymentStatus: { $in: ['Deposit Paid', 'Paid'] }, createdAt: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                total: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalAmount", "$depositAmount"] } }
            }}
        ]);

        // Aggregation for Expenses
        const expenseAgg = await Finance.aggregate([
            { $match: { type: 'expense', date: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: "$date" }, year: { $year: "$date" } },
                total: { $sum: "$amount" }
            }}
        ]);

        // Combine into 6 months response
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();

            const invoiceTotal = invoiceAgg.find(a => a._id.month === m && a._id.year === y)?.total || 0;
            const leadTotal = leadAgg.find(a => a._id.month === m && a._id.year === y)?.total || 0;
            const expenseTotal = expenseAgg.find(a => a._id.month === m && a._id.year === y)?.total || 0;

            const revenuePaise = toPaise(invoiceTotal) + toPaise(leadTotal);

            performanceData.push({
                name: months[d.getMonth()],
                revenue: revenuePaise / 100,
                expenses: toPaise(expenseTotal) / 100,
                cashFlow: (revenuePaise - toPaise(expenseTotal)) / 100
            });
        }

        res.json(performanceData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

