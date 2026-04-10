const express = require('express');
const Finance = require('../models/Finance');
const Invoice = require('../models/Invoice');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

const calculateFinanceStats = async () => {
    const paidInvoices = await Invoice.find({ status: 'Paid' });
    const invoiceSales = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const activeLeads = await Lead.find({ paymentStatus: { $in: ['Deposit Paid', 'Paid'] } });
    const leadSales = activeLeads.reduce((sum, lead) => {
        if (lead.paymentStatus === 'Paid') return sum + (lead.totalAmount || 0);
        if (lead.paymentStatus === 'Deposit Paid') return sum + (lead.depositAmount || 0);
        return sum;
    }, 0);

    const annualSales = invoiceSales + leadSales;

    const pendingInvoices = await Invoice.find({ status: { $ne: 'Paid' } });
    const pendingInvoiceAmt = pendingInvoices.reduce((sum, i) => sum + (i.total || 0), 0);

    const pendingLeads = await Lead.find({ paymentStatus: { $in: ['Unpaid', 'Deposit Paid'] } });
    const pendingLeadAmt = pendingLeads.reduce((sum, lead) => {
        if (lead.paymentStatus === 'Deposit Paid') return sum + ((lead.totalAmount || 0) - (lead.depositAmount || 0));
        if (lead.paymentStatus === 'Unpaid') return sum + (lead.totalAmount || 0);
        return sum;
    }, 0);

    const pendingRevenue = pendingInvoiceAmt + pendingLeadAmt;

    const expensesData = await Finance.find({ type: 'expense' });
    const totalExpenses = expensesData.reduce((sum, item) => sum + (item.amount || 0), 0);

    const annualProfit = annualSales - totalExpenses;

    return {
        annualSales,
        annualProfit,
        expenses: totalExpenses,
        pendingRevenue
    };
};

// Get Finance Overview (Stats)
router.get('/overview', auth, async (req, res) => {
    try {
        const stats = await calculateFinanceStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Treasury Allocation (Expenses by Category)
router.get('/allocation', auth, async (req, res) => {
    try {
        const aggregation = await Finance.aggregate([
            { $match: { type: 'expense' } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } }
        ]);

        const allCategories = ['Operational', 'Equipment', 'Travel', 'Marketing', 'Salary', 'Invoice Payment'];
        const totalExpenses = aggregation.reduce((sum, item) => sum + item.total, 0);

        const formatted = allCategories.map(cat => {
            const found = aggregation.find(item => item._id === cat);
            const value = found ? found.total : 0;
            return {
                label: cat,
                value: value,
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
    return map[category] || 'bg-gray-400';
}

// Add Generic Finance Entry
router.post('/', auth, async (req, res) => {
    try {
        const entry = new Finance(req.body);
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get Recent Transactions (Combined Invoices & Expenses)
router.get('/transactions', auth, async (req, res) => {
    try {
        // Fetch last 10 invoices (Paid or Pending)
        const recentInvoices = await Invoice.find()
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
                amount: inv.status === 'Paid' ? (inv.total || 0) : 0,
                pendingAmount: inv.status === 'Paid' ? 0 : (inv.total || 0),
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

// Add New Expense
router.post('/expense', auth, async (req, res) => {
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

        await Notification.create({
            title: "Expense Logged",
            description: `New ${category || 'General'} expense of ₹${amount} for "${title}".`,
            type: "Finance"
        });

        res.json(entry);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Expense
router.put('/expense/:id', auth, async (req, res) => {
    try {
        const { title, amount, category, date, status } = req.body;
        // PRESERVE EXISTING VALUES: Only overwrite changed fields
        const updateFields = {};
        if (category) updateFields.category = category;
        if (amount) updateFields.amount = amount;
        if (title) updateFields.description = title;
        if (date) updateFields.date = date;
        if (status) updateFields.status = status;

        const updated = await Finance.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );

        if (updated) {
            // FIX: UPDATE LOG INSTEAD OF CREATE - We notify of modification, but don't duplicate the entry
            await Notification.create({
                title: "Finance Record Modified",
                description: `Updated ${updated.category} entry: "${updated.description}" (₹${updated.amount}).`,
                type: "Finance"
            });
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Expense
router.delete('/expense/:id', auth, async (req, res) => {
    try {
        await Finance.findByIdAndDelete(req.params.id);
        res.json({ message: "Expense deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Safe Deletion for Income (Handled via Lead Payment resetting or Invoice deletion)
router.delete('/income/:incomeType/:id', auth, async (req, res) => {
    try {
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
            const deletedInvoice = await Invoice.findByIdAndDelete(id);
            if (!deletedInvoice) return res.status(404).json({ error: 'Invoice not found' });
            return res.json({ message: 'Invoice deleted successfully' });
        }

        return res.status(400).json({ error: 'Invalid income type' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Payment Plans (Pending Invoices)
router.get('/pending-payments', auth, async (req, res) => {
    try {
        const pendingInvoices = await Invoice.find({ status: { $ne: 'Paid' } }).sort({ invoiceDate: -1 }).lean();
        const pendingLeads = await Lead.find({ paymentStatus: { $in: ['Unpaid', 'Deposit Paid'] } }).sort({ createdAt: -1 }).lean();

        const formatted = [
            ...pendingInvoices.map(inv => ({
                id: inv._id,
                name: inv.clientName,
                type: 'Invoice',
                total: inv.total || 0,
                paid: 0,
                pending: inv.total || 0,
                status: 'Unpaid',
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
router.get('/monthly-performance', auth, async (req, res) => {
    try {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = new Date();
        const performanceData = [];

        // Calculate the range: 6 months ago to now
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Aggregation for Invoices
        const invoiceAgg = await Invoice.aggregate([
            { $match: { status: 'Paid', invoiceDate: { $gte: sixMonthsAgo } } },
            { $group: {
                _id: { month: { $month: "$invoiceDate" }, year: { $year: "$invoiceDate" } },
                total: { $sum: "$total" }
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

            const revenueTotal = invoiceTotal + leadTotal;

            performanceData.push({
                name: months[d.getMonth()],
                revenue: revenueTotal,
                expenses: expenseTotal,
                cashFlow: revenueTotal - expenseTotal
            });
        }

        res.json(performanceData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

