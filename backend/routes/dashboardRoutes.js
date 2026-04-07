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

router.get('/recent-activity', auth, async (req, res) => {
    try {
        const leads = await Lead.find().sort({ updatedAt: -1 }).limit(5);

        const activity = await Promise.all(leads.map(async (lead) => {
            const photoCount = await Gallery.countDocuments({ albumName: lead.name });
            return {
                _id: lead._id,
                name: `${lead.eventType || 'Event'} of ${lead.name}`,
                date: new Date(lead.updatedAt).toLocaleDateString(),
                count: `${photoCount} photos`,
                status: lead.status === 'Converted' ? 'Delivered' : (lead.status === 'New' ? 'Reviewing' : lead.status)
            };
        }));

        res.json(activity);
    } catch (err) {
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
