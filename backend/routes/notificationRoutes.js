const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(auth, requireAdmin);

function notificationForMember(row, req) {
    if (!req.saas) return row;
    const value = row.toObject();
    value.isRead = row.readBy?.some(id => String(id) === String(req.user.id)) || false;
    delete value.readBy;
    delete value.hiddenBy;
    delete value.eventKey;
    return value;
}

router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.find(req.saas ? { hiddenBy: { $ne: req.user.id } } : {}).sort({ createdAt: -1 }).limit(20);
        res.json(notifications.map(row => notificationForMember(row, req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const notif = await Notification.findByIdAndUpdate(req.params.id, req.saas ? { $addToSet: { readBy: req.user.id } } : { isRead: true }, { new: true });
        if (!notif) return res.status(404).json({ error: 'Notification not found.' });
        res.json(notificationForMember(notif, req));
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

router.post('/create', async (req, res) => {
    try {
        const { title, description, type, link } = req.body || {};
        const notif = new Notification({ title, description, type, link });
        await notif.save();
        res.json(notificationForMember(notif, req));
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ error: 'Enter a valid notification title and type.' });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
