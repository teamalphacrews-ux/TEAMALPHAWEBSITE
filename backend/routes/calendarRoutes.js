const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { sendEventNotification } = require('../services/ReminderService');
const { syncToGoogle, pollGoogleCalendar } = require('../services/googleCalendarService');
const { calendarConnection, createCalendarSyncHandler } = require('../utils/calendarConnection');

const { linkedEventFields, withAvailableCrew } = require('../utils/studioCalendar');
const router = express.Router();

router.use(auth, requireAdmin);
const ownerFilter = { studioOwner: true, accountDisabled: { $ne: true } };
const commercialWithoutWorkspace = req => process.env.SAAS_ENABLED === 'true' && (!req.saas || !require('../saas/tenantContext').currentWorkspace());
const mayManageCalendar = req => !commercialWithoutWorkspace(req) && (!req.saas || req.saas.membership.role === 'owner');
function manageConnection(req, res, next) {
    if (!mayManageCalendar(req)) return res.status(403).json({ message: 'Only the studio owner can manage the Google Calendar connection.' });
    if (req.saas && !['active','trialing'].includes(require('../saas/plans').accessStatus(req.saas.workspace)))
        return res.status(402).json({ message: 'Calendar sync requires an active studio subscription or trial.' });
    return next();
}

// Get Google Calendar sync status
router.get('/sync-status', async (req, res) => {
    try {
        if (commercialWithoutWorkspace(req)) return res.json({ configured: false, isSynced: false, canManage: false, setupMessage: 'Open a studio workspace to connect Google Calendar.' });
        const user = req.saas
            ? await User.findOne(ownerFilter, '+googleAccessToken +googleRefreshToken')
            : await User.findById(req.user.id, '+googleAccessToken +googleRefreshToken');
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ ...calendarConnection(user), canManage: mayManageCalendar(req) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Manually trigger Google Calendar sync
router.get('/sync-now', manageConnection, createCalendarSyncHandler({ User, pollGoogleCalendar }));

// Disconnect Google Calendar and delete synced events
router.post('/disconnect-google', manageConnection, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const unset = {
            googleAccessToken: 1, googleRefreshToken: 1, googleTokenExpiry: 1, googleEmail: 1,
            googleWebhookId: 1, googleResourceId: 1, googleSyncError: 1, googleLastSyncAt: 1,
        };
        if (req.saas) await require('../saas/calendarConnection').detachCalendar(User, user._id, unset);
        else await User.findByIdAndUpdate(user._id, { $unset: unset });

        // Mark all synced events as local-only instead of deleting them to prevent data loss
        if (!req.saas) await Event.updateMany(
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
        if (error.code === "calendar_busy") return res.status(409).json({ message: "Calendar sync is finishing. Try Disconnect again in a moment." });
        console.error("Calendar disconnect failed.");
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

async function publishEventChange(event, action, req, newCrew) {
    event.$session(null);
    let syncWarning;
    try {
        await syncToGoogle(event, action, req.user.id);
    } catch {
        syncWarning = action === 'CREATE'
            ? 'Local event saved, but Google synchronization failed.'
            : 'Local event updated, but Google synchronization failed.';
        console.warn('Calendar export failed after the local event was saved.');
    }
    if (newCrew.length) {
        void sendEventNotification(event, newCrew).catch(() => console.error('Calendar assignment notification failed.'));
    }
    req.io.to('admin').emit('calendar_update', { action, eventId: event._id });
    return syncWarning ? { ...event.toObject(), syncWarning } : event;
}

// Create new event
router.post('/', async (req, res) => {
    try {
        const values=await linkedEventFields(req.body);
        const event = await withAvailableCrew(values, null, async session => {
            const document = new Event({ ...values, ...( /^[a-f\d]{24}$/i.test(req.user.id)?{userId:req.user.id}:{} ), origin:'local' });
            return document.save({ session });
        });

        res.status(201).json(await publishEventChange(event, 'CREATE', req, event.teamMembers));
    } catch (error) {
        res.status(error.status || 400).json({ message: error.message });
    }
});

// Update event
router.patch('/:id', async (req, res) => {
    try {
        const current=await Event.findById(req.params.id);
        if(!current)return res.status(404).json({message:'Event not found'});
        if(current.isReadOnly)return res.status(403).json({message:'This Google-managed event is read only'});
        const values=await linkedEventFields(req.body,current.toObject());
        const event = await withAvailableCrew(values, current._id, session => Event.findOneAndUpdate(
            { _id: current._id, __v: current.__v ?? null, updatedAt: current.updatedAt ?? null },
            { $set: { ...values, __v: (current.__v ?? 0) + 1 } },
            { new: true, runValidators: true, session }
        ));
        if (!event) return res.status(409).json({ message: 'This event changed while you were editing. Reload and try again.' });
        const previousCrew = new Set(current.teamMembers);
        const newCrew = event.teamMembers.filter(name => !previousCrew.has(name));
        res.json(await publishEventChange(event, 'UPDATE', req, newCrew));
    } catch (error) {
        res.status(error.status || 400).json({ message: error.message });
    }
});

// Delete event
router.delete('/:id', async (req, res) => {
    try {
        await require('../services/studioSecurity').assertPermission(req.user.id, 'deletion');
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({message:'Event not found'});
        if (event.isReadOnly) return res.status(403).json({message:'This Google-managed event is read only'});
        const removed = await require('../services/studioRecovery').recoverableDelete({ Model: Event, filter: { _id: event._id }, actorId: req.user.id });
        if (!removed) return res.status(409).json({ message: 'This event changed before deletion.' });
        let syncWarning = '';
        if (event.googleEventId) {
            try {
                await syncToGoogle(event, 'DELETE', req.user.id);
            } catch (syncError) {
                console.error("The remote calendar event could not be deleted.");
                syncWarning = 'The studio event was removed, but Google Calendar could not be updated. Reconnect and check the Google event.';
            }
        }

        // Trigger Socket.IO broadcast for instant UI update across all clients
        req.io.to('admin').emit('calendar_update', { action: 'DELETE', eventId: req.params.id });

        res.json({ message: 'Event moved to recovery.', ...(syncWarning ? { warning: syncWarning } : {}) });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'The calendar event could not be removed.' });
    }
});

module.exports = router;
