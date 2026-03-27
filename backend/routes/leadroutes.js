const express = require('express');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Photographer = require('../models/Photographer');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
    const leads = await Lead.find().populate('tasks');
    res.json(leads);
});

router.post('/', auth, async (req, res) => {
    try {
        const { createAccount, firstName, lastName, accountEmail, password, ...leadData } = req.body;

        // Save lead
        const lead = new Lead(leadData);
        await lead.save();

        // Create User Account if requested
        if (createAccount && firstName && lastName && password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = new User({
                firstName,
                lastName,
                email: accountEmail || req.body.email,
                password: hashedPassword,
                role: 'client',
                galleryTag: leadData.galleryTag,
                cloudLink: leadData.cloudLink,
                cloudPassword: leadData.cloudPassword,
                leadId: lead._id
            });
            await newUser.save();
        }

        await Notification.create({
            title: "New Lead Acquired",
            description: `${lead.name} has been added to the registry as a new ${lead.status} lead.`,
            type: "Lead"
        });

        res.json(lead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Task specific management
router.post('/:id/tasks', auth, async (req, res) => {
    const task = new Task({ ...req.body, lead: req.params.id });
    await task.save();
    await Lead.findByIdAndUpdate(req.params.id, { $push: { tasks: task._id } });
    res.json(task);
});

// PATCH Lead
router.patch('/:id', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const oldLead = await Lead.findById(req.params.id);
        if (!oldLead) return res.status(404).json({ error: "Lead not found" });

        const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });

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

        res.json(updatedLead);
    } catch (err) {
        console.error(`[LEAD_PATCH_ERROR] ID: ${req.params.id}, Body:`, req.body, err);
        res.status(500).json({ error: "Failed to update lead: " + err.message });
    }
});

// POST Remind Photographer
router.post('/:id/remind/:photographerName', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
    try {
        await Lead.findByIdAndDelete(req.params.id);
        res.json({ message: "Lead deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
