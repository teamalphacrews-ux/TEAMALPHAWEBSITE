const express = require('express');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Photographer = require('../models/Photographer');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { createLeadHandler } = require('../utils/createLead');
const pipeline = require('../services/enquiryPipeline');

const router = express.Router();

router.use(auth, requireAdmin);

// Webhook receipts and database operators cannot be set through CRM mass assignment.
const editableLeadFields = new Set(['name', 'email', 'phone', 'status', 'remarks', 'eventType',
    'eventDate', 'eventTime', 'eventLocation', 'followUpDate', 'notes', 'tasks', 'people',
    'paymentStatus', 'totalAmount', 'depositAmount', 'galleryTag', 'cloudLink', 'cloudPassword']);
const allowedLeadFields = data => Object.fromEntries(Object.entries(data).filter(([key]) => editableLeadFields.has(key)));

router.get('/', async (req, res) => {
    try {
        const warnings = await pipeline.reconcile();
        if (warnings.length) res.set('X-Studio-Link-Warnings', String(warnings.length));
        const leads = await Lead.find().populate('tasks').sort({ createdAt: -1 });
        res.json(leads);
    } catch { res.status(503).json({ error: 'Enquiries are unavailable. Please retry.' }); }
});

router.post('/', createLeadHandler({ Lead, User, Notification, bcrypt, allowedLeadFields }));

// Task specific management
router.post('/:id/tasks', async (req, res) => {
    try {
        const { taskValues, validateTaskLinks } = require('../utils/productionTask');
        const values = taskValues({ ...req.body, lead: req.params.id });
        await validateTaskLinks(values);
        const task = await Task.create(values);
        await Lead.updateOne({ _id: req.params.id }, { $addToSet: { tasks: task._id } });
        res.json(task);
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'The production task could not be saved.' }); }
});

// PATCH Lead
router.patch('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const oldLead = await Lead.findById(req.params.id);
        if (!oldLead) return res.status(404).json({ error: "Lead not found" });

        const updatedLead = await Lead.findByIdAndUpdate(req.params.id, allowedLeadFields(req.body), { new: true, runValidators: true });
        await pipeline.syncFromEnquiry(updatedLead, req.body);
        if (status === 'Converted' && oldLead.status !== 'Converted')
            await require('../services/productionTemplates').applyDefaultProduction(updatedLead._id);

        // Update corresponding User if linked or email matches
        if (updatedLead) {
            await User.findOneAndUpdate(
                { $or: [{ leadId: updatedLead._id }, { email: updatedLead.email }] },
                {
                    galleryTag: updatedLead.galleryTag,
                    cloudLink: updatedLead.cloudLink,
                    cloudPassword: updatedLead.cloudPassword,
                    leadId: updatedLead._id
                }
            );
        }

        if (status && oldLead.status !== status) {
            console.log(`[LEAD_STATUS_CHANGE] Lead ID: ${req.params.id}, Old Status: ${oldLead.status}, New Status: ${status}`);
            await Notification.create({
                title: "Lead Status Updated",
                description: `${updatedLead.name}'s status was changed from ${oldLead.status} to ${status}.`,
                type: "Lead"
            });
        }

        res.json(await Lead.findById(req.params.id).populate('tasks'));
    } catch (err) {
        console.error(`[LEAD_PATCH_ERROR] ID: ${req.params.id}, Body:`, req.body, err);
        res.status(500).json({ error: "Failed to update lead: " + err.message });
    }
});

// POST Remind Photographer
router.post('/:id/remind/:photographerName', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        const photographer = await Photographer.findOne({ name: req.params.photographerName });

        if (!lead || !photographer) {
            return res.status(404).json({ message: "Lead or Photographer not found" });
        }

        res.json({ message: "Reminder mocked (Email service invalid)" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Lead
router.delete('/:id', async (req, res) => {
    try {
        await require('../services/studioSecurity').assertPermission(req.user.id, 'deletion');
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Enquiry not found' });
        if (lead.studioProjectId) {
            const archived = await Lead.findByIdAndUpdate(lead._id, { $set: { status: 'Archived' } }, { new: true });
            await pipeline.syncFromEnquiry(archived, { status: 'Archived' });
            return res.json({ archived: true });
        }
        await require('../services/studioRecovery').recoverableDelete({ Model: Lead, filter: { _id: req.params.id }, actorId: req.user.id });
        res.json({ message: "Lead deleted successfully" });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'The enquiry could not be removed.' });
    }
});

module.exports = router;
