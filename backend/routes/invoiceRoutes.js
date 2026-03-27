const express = require('express');
const Invoice = require('../models/Invoice');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const invoice = new Invoice(req.body);
        await invoice.save();

        await Notification.create({
            title: "Invoice Generated",
            description: `Registry updated with a new invoice for ${invoice.clientName} (₹${invoice.total}).`,
            type: "Invoice"
        });

        res.status(201).json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Invoice
router.put('/:id', auth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!updatedInvoice) return res.status(404).json({ message: "Invoice not found" });

        await Notification.create({
            title: "Invoice Updated",
            description: `Invoice for ${updatedInvoice.clientName} is now marked as ${updatedInvoice.status}.`,
            type: "Invoice"
        });

        res.json(updatedInvoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Invoice
router.delete('/:id', auth, async (req, res) => {
    try {
        const deleted = await Invoice.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Invoice not found" });
        res.json({ message: "Invoice deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
