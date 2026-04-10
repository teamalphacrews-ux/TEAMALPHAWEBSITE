const express = require('express');
const Lead = require('../models/Lead');
const Gallery = require('../models/Gallery');
const DriveGallery = require('../models/DriveGallery');
const User = require('../models/User');
const Task = require('../models/Task');
const Finance = require('../models/Finance');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/stats', auth, async (req, res) => {
    try {
        // Compute Total Clients and Published/Uploaded Drives
        const totalClients = await User.countDocuments({ role: 'client' });
        const totalDrives = await DriveGallery.countDocuments();
        
        // This variable is returned to frontend as 'totalPhotos' to minimize frontend changes
        // But semantically now represents clients and drives count
        const totalPhotos = `${totalClients} Clients / ${totalDrives} Drives`;

        const leadsCount = await Lead.countDocuments();

        // Calculate actual storage used by summing the size of all gallery items
        const storageStats = await Gallery.aggregate([
            { $group: { _id: null, totalSizeBytes: { $sum: "$size" } } }
        ]);

        const actualSizeBytes = storageStats[0]?.totalSizeBytes || 0;
        const avgPhotoSizeMB = 15; // Assumption for legacy items without size field
        const photosWithoutSize = await Gallery.countDocuments({ $or: [{ size: 0 }, { size: { $exists: false } }] });
        
        const totalUsedMB = (actualSizeBytes / (1024 * 1024)) + (photosWithoutSize * avgPhotoSizeMB);
        const totalStorageLimitMB = 1048576; // 1 TB
        const usedPercentage = ((totalUsedMB / totalStorageLimitMB) * 100).toFixed(2);

        const storageUsage = `${usedPercentage}%`;

        // Count non-completed tasks as pending approvals/actions
        const pendingApprovals = await Task.countDocuments({ status: 'pending' });

        // Simulate organic traffic based on engagement (leads and total photos)
        // This provides a "live" feel to the dashboard metrics
        const baseTraffic = (leadsCount * 50) + (totalClients * 10);
        const randomFluctuation = Math.floor(Math.random() * 20); // Add a small random factor
        const organicTraffic = baseTraffic + randomFluctuation;
        const traffic = organicTraffic >= 1000 ? `${(organicTraffic / 1000).toFixed(1)}K` : organicTraffic.toString();

        res.json({
            totalPhotos,
            storageUsage,
            pendingApprovals,
            traffic
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const GalleryEvent = require('../models/GalleryEvent');

router.get('/recent-activity', auth, async (req, res) => {
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

        const activity = [];

        // Add lead updates to activity
        for (const lead of leads) {
            const photoCount = await Gallery.countDocuments({ albumName: lead.name });
            activity.push({
                _id: lead._id,
                name: `${lead.eventType || 'Event'} of ${lead.name}`,
                date: new Date(lead.updatedAt).toLocaleDateString(),
                count: `${photoCount} photos`,
                status: lead.status === 'Converted' ? 'Delivered' : (lead.status === 'New' ? 'Reviewing' : lead.status),
                timestamp: lead.updatedAt,
                rawName: lead.name,
                rawDate: lead.eventDate,
                rawType: lead.eventType
            });
        }

        // Add gallery event folders to activity
        for (const event of recentEvents) {
            let lead = event.clientId?.clientId?.leadId;
            const clientName = event.clientId?.name || event.clientId?.clientId?.firstName || "Unknown Client";

            // FALLBACK: If direct ID linkage is missing, search for the Lead by name matching the DriveGallery/Client name
            if (!lead && event.clientId?.name) {
                const searchName = event.clientId.name.trim();
                lead = await Lead.findOne({
                    name: { $regex: new RegExp('^' + searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
                });
            }

            // If we found a Lead, use its ID for consistency with Edit/Delete features
            // If NO Lead exists, we still show the event for the User/Client
            const activityId = lead ? lead._id : event._id;
            const displayName = lead ? lead.name : clientName;

            const leadIndex = activity.findIndex(a => a._id?.toString() === activityId?.toString());
            
            if (leadIndex !== -1) {
                const leadEntry = activity[leadIndex];
                const timeDiff = Math.abs(new Date(event.createdAt) - new Date(leadEntry.timestamp));
                
                if (new Date(event.createdAt) >= new Date(leadEntry.timestamp) || timeDiff < 10000) {
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

router.get('/upcoming-events', auth, async (req, res) => {
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
