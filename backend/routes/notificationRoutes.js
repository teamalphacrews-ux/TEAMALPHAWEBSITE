const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.find(req.saas ? { hiddenBy: { $ne: req.user.id } } : {}).sort({ createdAt: -1 }).limit(20);
        res.json(req.saas ? notifications.map(row => ({ ...row.toObject(), readBy: undefined, hiddenBy: undefined, isRead: row.readBy?.some(id => String(id) === req.user.id) || false })) : notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const notif = await Notification.findByIdAndUpdate(req.params.id, req.saas ? { $addToSet: { readBy: req.user.id } } : { isRead: true }, { new: true });
        res.json(notif);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/mark-all-read', async (req, res) => {
    try {
        await Notification.updateMany(req.saas ? {} : { isRead: false }, req.saas ? { $addToSet: { readBy: req.user.id } } : { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/clear-all', async (req, res) => {
    try {
        if (req.saas) await Notification.updateMany({}, { $addToSet: { hiddenBy: req.user.id } });
        else await Notification.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (req.saas) await Notification.updateOne({ _id: req.params.id }, { $addToSet: { hiddenBy: req.user.id } });
        else await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper for testing
router.post('/create', async (req, res) => {
    try {
        const notif = new Notification(req.body);
        await notif.save();
        res.json(notif);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
