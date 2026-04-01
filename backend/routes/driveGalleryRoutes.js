const express = require('express');
const router = express.Router();
const DriveGallery = require('../models/DriveGallery');
const GalleryEvent = require('../models/GalleryEvent');
const GoogleDriveService = require('../services/googleDriveService');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const CloudinaryStorageModule = require('multer-storage-cloudinary');
const CloudinaryStorage = CloudinaryStorageModule.CloudinaryStorage || CloudinaryStorageModule;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage specifically for gallery thumbnails (FAST)
const thumbnailStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'team-alpha-gallery-thumbnails',
        resource_type: 'auto'
    },
});

const upload = multer({ storage: thumbnailStorage });

/**
 * @route   POST /api/drive-gallery
 * @desc    Create a new Client Collection (Top Level)
 */
router.post('/', auth, (req, res) => {
    upload.single('thumbnail')(req, res, async function (err) {
        if (err) {
            console.error("Multer upload error (Client):", err);
            return res.status(500).json({ error: "File upload failed: " + err.message });
        }

        try {
            const { name } = req.body;
            
            if (!name) {
                return res.status(400).json({ error: "Client name is required" });
            }

            // Thumbnail is optional
            const thumbnailUrl = req.file ? req.file.path : "";

            const client = new DriveGallery({
                name,
                thumbnail: thumbnailUrl
            });

            await client.save();
            res.status(201).json(client);
        } catch (error) {
            console.error("Client Creation Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * @route   POST /api/drive-gallery/:clientId/events
 * @desc    Create a new Event under a Client
 */
router.post('/:clientId/events', auth, (req, res) => {
    upload.single('thumbnail')(req, res, async function (err) {
        if (err) {
            console.error("Multer upload error (Event):", err);
            return res.status(500).json({ error: "File upload failed: " + err.message });
        }

        try {
            const { name, driveLink, eventDate } = req.body;
            const { clientId } = req.params;
            
            if (!name || !driveLink) {
                return res.status(400).json({ error: "Event name and Drive link are required" });
            }

            const driveFolderId = GoogleDriveService.extractFolderId(driveLink);
            if (!driveFolderId) {
                return res.status(400).json({ error: "Invalid Google Drive link" });
            }

            // Thumbnail is optional
            const thumbnailUrl = req.file ? req.file.path : "";

            const event = new GalleryEvent({
                clientId,
                name,
                thumbnail: thumbnailUrl,
                driveFolderId,
                eventDate: eventDate || new Date()
            });

            await event.save();
            res.status(201).json(event);
        } catch (error) {
            console.error("Event Creation Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * @route   GET /api/drive-gallery/:clientId/events
 * @desc    List all events for a client
 */
router.get('/:clientId/events', auth, async (req, res) => {
    try {
        const events = await GalleryEvent.find({ clientId: req.params.clientId }).sort({ eventDate: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/drive-gallery
 * @desc    Get all gallery collections
 */
router.get('/', auth, async (req, res) => {
    try {
        const galleries = await DriveGallery.find().sort({ createdAt: -1 });
        res.json(galleries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/drive-gallery/files/:eventId
 * @desc    Fetch images/videos for a specific Event
 */
router.get('/files/:eventId', auth, async (req, res) => {
    try {
        const event = await GalleryEvent.findById(req.params.eventId);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        const files = await GoogleDriveService.getFolderContents(event.driveFolderId);
        
        // Filter: only images and videos
        const filteredFiles = files.filter(f => 
            f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
        );

        res.json(filteredFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/drive-gallery/:id
 * @desc    Remove a client and all its events
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        await DriveGallery.findByIdAndDelete(req.params.id);
        await GalleryEvent.deleteMany({ clientId: req.params.id });
        res.json({ message: "Client and associated events removed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/drive-gallery/event/:eventId
 * @desc    Get single event info
 */
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const event = await GalleryEvent.findById(req.params.eventId);
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/drive-gallery/:id
 * @desc    Get client info
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const client = await DriveGallery.findById(req.params.id);
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   PATCH /api/drive-gallery/:id
 * @desc    Update a Client
 */
router.patch('/:id', auth, upload.single('thumbnail'), async (req, res) => {
    try {
        const { name } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (req.file) updateData.thumbnail = req.file.path;

        const client = await DriveGallery.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(client);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   PATCH /api/drive-gallery/events/:eventId
 * @desc    Update an Event
 */
router.patch('/events/:eventId', auth, upload.single('thumbnail'), async (req, res) => {
    try {
        const { name, driveLink, eventDate } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (eventDate) updateData.eventDate = eventDate;
        if (driveLink) {
            const driveFolderId = GoogleDriveService.extractFolderId(driveLink);
            if (driveFolderId) updateData.driveFolderId = driveFolderId;
        }
        if (req.file) updateData.thumbnail = req.file.path;

        const event = await GalleryEvent.findByIdAndUpdate(req.params.eventId, updateData, { new: true });
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/drive-gallery/events/:eventId
 * @desc    Remove an Event
 */
router.delete('/events/:eventId', auth, async (req, res) => {
    try {
        await GalleryEvent.findByIdAndDelete(req.params.eventId);
        res.json({ message: "Event removed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
