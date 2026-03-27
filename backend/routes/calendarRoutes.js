const express = require('express');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { sendEventNotification } = require('../services/ReminderService');

const router = express.Router();

// Get all events
router.get('/', auth, async (req, res) => {
    try {
        const events = await Event.find().sort({ start: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new event
router.post('/', auth, async (req, res) => {
    try {
        const { start, end, location } = req.body;

        // Check for overlapping events at the same location or same time
        const overlapping = await Event.findOne({
            $or: [
                {
                    start: { $lt: new Date(end) },
                    end: { $gt: new Date(start) }
                }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ 
                message: "Scheduling Conflict: Another event is already scheduled during this time.",
                conflictingEvent: overlapping.title
            });
        }

        const event = new Event(req.body);
        await event.save();

        // Trigger real time email notification to assigned photographers
        if (event.teamMembers && event.teamMembers.length > 0) {
            sendEventNotification(event, event.teamMembers);
        }

        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update event
router.patch('/:id', auth, async (req, res) => {
    try {
        const { start, end } = req.body;

        if (start || end) {
            const currentEvent = await Event.findById(req.params.id);
            const newStart = start ? new Date(start) : currentEvent.start;
            const newEnd = end ? new Date(end) : currentEvent.end;

            const overlapping = await Event.findOne({
                _id: { $ne: req.params.id },
                start: { $lt: newEnd },
                end: { $gt: newStart }
            });

            if (overlapping) {
                return res.status(400).json({ 
                    message: "Scheduling Conflict: Update would overlap with another event.",
                    conflictingEvent: overlapping.title
                });
            }
        }

        const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // Trigger real time email notification to newly assigned photographers
        if (event && req.body.teamMembers) {
            sendEventNotification(event, req.body.teamMembers);
        }

        res.json(event);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
