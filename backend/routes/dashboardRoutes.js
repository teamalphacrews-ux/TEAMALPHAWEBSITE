const express = require('express');
const Lead = require('../models/Lead');
const Gallery = require('../models/Gallery');
const DriveGallery = require('../models/DriveGallery');
const User = require('../models/User');
const Task = require('../models/Task');
const Finance = require('../models/Finance');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const Event = require('../models/Event');
const Invoice = require('../models/Invoice');
const { currentWorkspace } = require('../saas/tenantContext');
const { hasFullAccess } = require('../utils/moduleAccess');
const Photographer = require('../models/Photographer');
const StudioConfig = require('../models/StudioConfig');
const { buildStudioOverview } = require('../utils/studioOverview');
const { studioDayStart } = require('../utils/studioDay');
const { overviewTimezone, overviewInsightWindow, overviewActivityPipeline, buildOverviewInsights } = require('../utils/studioOverviewInsights');

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/studio-overview', async (req, res) => {
    try {
        const now = new Date();
        const studio = await StudioConfig.findOne({ key: 'studio' }).select('timezone').lean();
        const timezone = req.query?.timezone === undefined ? overviewTimezone(studio?.timezone) : overviewTimezone(req.query.timezone, true);
        const todayStart = studioDayStart(now, timezone);
        const ownerActions = req.query?.nextActions === '1' && req.workspaceRole === 'owner'
            && hasFullAccess(req.user) && Boolean(currentWorkspace());
        const insightWindow = overviewInsightWindow(now, timezone);
        const throughNow = new Date(now.getTime() + 1);
        const [leadCounts, upcomingEventCount, pendingTaskCount, overdueTaskCount,
            activeCrew, clientCollections, events, datedTasks, undatedTasks, recentLeads,
            leadActivity, eventActivity, taskActivity, taskDueActivity, completedTaskCount,
            scheduledFollowUps, draftInvoices] = await Promise.all([
            Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Event.countDocuments({ end: { $gte: now } }),
            Task.countDocuments({ status: 'pending' }),
            Task.countDocuments({ status: 'pending', dueDate: { $lt: todayStart, $ne: null } }),
            Photographer.countDocuments({ status: 'Active' }),
            DriveGallery.countDocuments(),
            Event.find({ end: { $gte: now } }).sort({ start: 1 }).limit(6)
                .select(ownerActions ? 'title start end type location teamMembers lead allDay startDate endDateExclusive' : 'title start end type location teamMembers lead').lean(),
            Task.find({ status: 'pending', dueDate: { $ne: null } }).sort({ dueDate: 1 }).limit(8)
                .select('title status dueDate lead').populate('lead', 'name eventDate').lean(),
            Task.find({ status: 'pending', dueDate: null }).sort({ createdAt: -1 }).limit(8)
                .select('title status dueDate lead').populate('lead', 'name eventDate').lean(),
            Lead.find().sort({ createdAt: -1 }).limit(6)
                .select('name eventType eventDate status followUpDate createdAt').lean(),
            Lead.aggregate(overviewActivityPipeline('createdAt', insightWindow.previousStart, throughNow, timezone)),
            Event.aggregate(overviewActivityPipeline('start', insightWindow.start, insightWindow.end, timezone)),
            Task.aggregate(overviewActivityPipeline('createdAt', insightWindow.start, throughNow, timezone)),
            Task.aggregate(overviewActivityPipeline('dueDate', insightWindow.start, insightWindow.end, timezone, true)),
            Task.countDocuments({ status: 'completed' }),
            ownerActions ? Lead.find({ status: { $in: ['New', 'Follow-up', 'Meeting', 'Negotiation'] }, followUpDate: { $type: 'date' } })
                .sort({ followUpDate: 1, _id: 1 }).limit(6).select('name status followUpDate eventType').lean() : undefined,
            ownerActions ? Invoice.find({ documentStatus: 'Draft', status: { $nin: ['Paid', 'Cancelled'] } })
                .sort({ createdAt: 1, _id: 1 }).limit(3).select('clientName documentNumber createdAt').lean() : undefined,
        ]);
        res.json(buildStudioOverview({
            leadCounts, upcomingEventCount, pendingTaskCount, overdueTaskCount,
            activeCrew, clientCollections, events, datedTasks, undatedTasks, recentLeads, scheduledFollowUps, draftInvoices,
            insights: buildOverviewInsights({ leadCounts, leadActivity, eventActivity, taskActivity,
                taskDueActivity, completedTaskCount, pendingTaskCount }, now, timezone),
        }, now));
    } catch (err) {
        console.error('Studio overview error:', err.message);
        res.status(err.status === 400 ? 400 : 500).json({ error: err.status === 400 ? err.message : 'Unable to load the studio overview' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        // Compute Total Clients and Published/Uploaded Drives
        const totalClients = await User.countDocuments({ role: 'client' });
        const totalDrives = await DriveGallery.countDocuments();
        
        // This variable is returned to frontend as 'totalPhotos' to minimize frontend changes
        // But semantically now represents clients and drives count
        const totalPhotos = `${totalClients} Clients / ${totalDrives} Drives`;

        // Calculate actual storage used by summing the size of all gallery items
        const storageStats = await Gallery.aggregate([
            { $group: { _id: null, totalSizeBytes: { $sum: "$size" } } }
        ]);

        const actualSizeBytes = storageStats[0]?.totalSizeBytes || 0;
        const photosWithoutSize = await Gallery.countDocuments({ $or: [{ size: 0 }, { size: { $exists: false } }] });

        // Count non-completed tasks as pending approvals/actions
        const pendingApprovals = await Task.countDocuments({ status: 'pending' });

        res.json({
            totalPhotos,
            storageUsage: null,
            storageBytes: actualSizeBytes,
            storageUnknownItems: photosWithoutSize,
            pendingApprovals,
            traffic: null,
            trafficAvailable: false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const GalleryEvent = require('../models/GalleryEvent');

router.get('/recent-activity', async (req, res) => {
    try {
        // Fetch 5 most recent leads
        const leads = await Lead.find().sort({ updatedAt: -1 }).limit(5);
        
        // Fetch 5 most recent gallery folders (events)
        const recentEvents = await GalleryEvent.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate({
                path: 'clientId',
                model: 'DriveGallery',
                populate: {
                    path: 'clientId',
                    model: 'User',
                    populate: {
                        path: 'leadId',
                        model: 'Lead'
                    }
                }
            });

        const counts = await Event.aggregate([
            { $match: { lead: { $in: leads.map(lead => lead._id) }, 'photos.0': { $exists: true } } },
            { $unwind: '$photos' },
            { $group: { _id: { lead: '$lead', photo: '$photos' } } },
            { $lookup: { from: Gallery.collection.name, localField: '_id.photo', foreignField: '_id', as: 'media' } },
            { $unwind: '$media' },
            { $match: { 'media.type': { $in: ['image', null] } } },
            { $group: { _id: '$_id.lead', count: { $sum: 1 } } },
        ]);
        const photosByLead = new Map(counts.map(row => [String(row._id), row.count]));
        const activity = [];

        // Add lead updates to activity
        for (const lead of leads) {
            const photoCount = photosByLead.get(String(lead._id)) || 0;
            activity.push({
                _id: lead._id,
                name: `${lead.eventType || 'Event'} of ${lead.name}`,
                date: new Date(lead.updatedAt).toLocaleDateString(),
                count: `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`,
                status: lead.status === 'Converted' ? 'Delivered' : (lead.status === 'New' ? 'Reviewing' : lead.status),
                timestamp: lead.updatedAt,
                rawName: lead.name,
                rawDate: lead.eventDate,
                rawType: lead.eventType,
                isLead: true
            });
        }

        // Add gallery event folders to activity
        for (const event of recentEvents) {
            const lead = event.clientId?.clientId?.leadId;
            const clientName = event.clientId?.name || event.clientId?.clientId?.firstName || "Unknown Client";

            // If we found a Lead, use its ID for consistency with Edit/Delete features
            // If NO Lead exists, we still show the event for the User/Client
            const activityId = lead ? lead._id : event._id;
            const displayName = lead ? lead.name : clientName;

            const leadIndex = activity.findIndex(a => a._id?.toString() === activityId?.toString());
            
            if (leadIndex !== -1) {
                const leadEntry = activity[leadIndex];
                if (new Date(event.createdAt) >= new Date(leadEntry.timestamp)) {
                    activity[leadIndex] = {
                        _id: activityId,
                        name: `${event.name} for ${displayName}`,
                        date: new Date(event.createdAt).toLocaleDateString(),
                        count: `New Gallery Folder`,
                        status: 'Delivered',
                        timestamp: event.createdAt,
                        rawName: displayName,
                        rawDate: event.eventDate || (lead ? lead.eventDate : null),
                        rawType: event.name,
                        isLead: !!lead
                    };
                }
            } else {
                activity.push({
                    _id: activityId,
                    name: `${event.name} for ${displayName}`,
                    date: new Date(event.createdAt).toLocaleDateString(),
                    count: `New Gallery Folder`,
                    status: 'Delivered',
                    timestamp: event.createdAt,
                    rawName: displayName,
                    rawDate: event.eventDate || (lead ? lead.eventDate : null),
                    rawType: event.name,
                    isLead: !!lead
                });
            }
        }

        // Sort by most recent overall and take top 5
        const sortedActivity = activity
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);

        res.json(sortedActivity);
    } catch (err) {
        console.error("Recent activity error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/upcoming-events', async (req, res) => {
    try {
        const today = new Date();
        const events = await Lead.find({
            eventDate: { $gte: today }
        })
            .sort({ eventDate: 1 })
            .limit(5);

        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
