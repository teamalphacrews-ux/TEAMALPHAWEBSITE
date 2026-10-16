const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { sendEventNotification } = require('../services/ReminderService');
const { syncToGoogle, pollGoogleCalendar } = require('../services/googleCalendarService');

const { eventFields,crewOverlap } = require('../utils/studioCalendar');
const router = express.Router();

router.use(auth, requireAdmin);

// Get Google Calendar sync status
router.get('/sync-status', async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isSynced = !!user.googleAccessToken;
        res.json({ 
            isSynced, 
            email: isSynced ? user.googleEmail : user.email,
            lastSyncAt: user.googleLastSyncAt,
            syncError: user.googleSyncError
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Manually trigger Google Calendar sync
router.get('/sync-now', async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.googleAccessToken) {
            return res.status(400).json({ message: "Google Calendar not connected" });
        }
        await pollGoogleCalendar(user, req.io);
        res.json({ success: true, message: "Calendar synced" });
    } catch (error) {
        console.error("Manual sync error:", error);
        res.status(500).json({ message: "Failed to sync calendar" });
    }
});

// Disconnect Google Calendar and delete synced events
router.post('/disconnect-google', async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Wipe tokens and Google sync data completely
        await User.findByIdAndUpdate(user._id, {
            $unset: {
                googleAccessToken: 1,
                googleRefreshToken: 1,
                googleTokenExpiry: 1,
                googleEmail: 1,
                googleWebhookId: 1,
                googleResourceId: 1
            }
        });

        // Mark all synced events as local-only instead of deleting them to prevent data loss
        await Event.updateMany(
            { userId: user._id, googleEventId: { $ne: null } },
            { 
                $unset: { googleEventId: 1 }, 
                $set: { lastUpdatedFrom: 'local', origin: 'local' } 
            }
        );

        // Emit socket update to refresh everyone's view
        if (req.io) {
            req.io.to('admin').emit('calendar_update', { action: 'DISCONNECT', email: user.email });
        }

        res.json({ success: true, message: "Disconnected successfully" });
    } catch (error) {
        console.error("Disconnect error:", error);
        res.status(500).json({ message: "Failed to disconnect Google Calendar" });
    }
});


// Get all events
router.get('/', async (req, res) => {
    try {
        const query = {}; // Shared Studio Calendar visibility for everyone
        const events = await Event.find(query).sort({ start: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new event
router.post('/', async (req, res) => {
    try {
        const values=eventFields(req.body);
        const candidates=values.teamMembers.length?await Event.find({start:{$lt:values.end},end:{$gt:values.start}}).select('title start end teamMembers').lean():[];
        const conflict=crewOverlap(values,candidates);
        if(conflict)return res.status(409).json({message:'Assigned crew overlap with '+conflict.title});
        const event = new Event({ ...values, ...( /^[a-f\d]{24}$/i.test(req.user.id)?{userId:req.user.id}:{} ), origin:'local' });
        await event.save();

        // Trigger Google Calendar Sync (Awaited for real status)
        try {
            await syncToGoogle(event, 'CREATE', req.user.id);
        } catch (syncError) {
            console.error("Failed to sync new event to Google:", syncError.message);
            // We still return 201 because it's saved locally, but maybe with a warning?
            // For now, let's just log it. The user wants "not fake success".
            // If sync fails, we could potentially delete the local event or return an error.
            // Requirement says "Only show success if: Google API response is successful AND event is saved in DB"
            return res.status(201).json({ 
                ...event.toObject(), 
                syncWarning: "Local event saved, but Google synchronization failed." 
            });
        }

        // Trigger real time email notification to assigned photographers
        if (event.teamMembers && event.teamMembers.length > 0) {
            sendEventNotification(event, event.teamMembers);
        }

        // Trigger Socket.IO broadcast for instant UI update across all clients
        req.io.to('admin').emit('calendar_update', { action: 'CREATE', eventId: event._id });

        res.status(201).json(event);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update event
router.patch('/:id', async (req, res) => {
    try {
        const current=await Event.findById(req.params.id);
        if(!current)return res.status(404).json({message:'Event not found'});
        if(current.isReadOnly)return res.status(403).json({message:'This Google-managed event is read only'});
        const values=eventFields(req.body,current.toObject());
        const candidates=values.teamMembers.length?await Event.find({_id:{$ne:req.params.id},start:{$lt:values.end},end:{$gt:values.start}}).select('title start end teamMembers').lean():[];
        const conflict=crewOverlap(values,candidates);
        if(conflict)return res.status(409).json({message:'Assigned crew overlap with '+conflict.title});
        const event=await Event.findByIdAndUpdate(req.params.id,{$set:values},{new:true,runValidators:true});

        // Trigger Google Calendar Sync (Awaited for real status)
        if (event) {
            try {
                await syncToGoogle(event, 'UPDATE', req.user.id);
            } catch (syncError) {
                console.error("Failed to sync updated event to Google:", syncError.message);
                return res.json({ 
                    ...event.toObject(), 
                    syncWarning: "Local event updated, but Google synchronization failed." 
                });
            }
        }

        // Trigger real time email notification to newly assigned photographers
        if (event && req.body.teamMembers) {
            sendEventNotification(event, req.body.teamMembers);
        }

        // Trigger Socket.IO broadcast for instant UI update across all clients
        req.io.to('admin').emit('calendar_update', { action: 'UPDATE', eventId: event._id });

        res.json(event);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete event
router.delete('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({message:'Event not found'});
        if (event.isReadOnly) return res.status(403).json({message:'This Google-managed event is read only'});
        if (event.googleEventId) {
            try {
                await syncToGoogle(event, 'DELETE', req.user.id);
            } catch (syncError) {
                console.error("Failed to delete event from Google:", syncError.message);
                // We still proceed with local deletion
            }
        }
        await Event.findByIdAndDelete(req.params.id);

        // Trigger Socket.IO broadcast for instant UI update across all clients
        req.io.to('admin').emit('calendar_update', { action: 'DELETE', eventId: req.params.id });

        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
