const express = require('express');
const router = express.Router();
const DriveGallery = require('../models/DriveGallery');
const GalleryEvent = require('../models/GalleryEvent');
const GoogleDriveService = require('../services/googleDriveService');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const CloudinaryStorageModule = require('multer-storage-cloudinary');
const CloudinaryStorage = CloudinaryStorageModule.CloudinaryStorage || CloudinaryStorageModule;

const User = require('../models/User');
const Lead = require('../models/Lead');

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
 * @route   GET /api/drive-gallery/users/clients
 * @desc    List all registered client users for dropdown
 */
router.get('/users/clients', auth, async (req, res) => {
    try {
        const User = require('../models/User');
        const clients = await User.find({ role: 'client' }).select('firstName lastName email');
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
            const { name, password, clientId } = req.body;

            if (!name) {
                return res.status(400).json({ error: "Client name is required" });
            }

            // Optional: Hash access password
            let passwordHash = "";
            if (password) {
                const salt = await bcrypt.genSalt(10);
                passwordHash = await bcrypt.hash(password, salt);
            }

            // Thumbnail is optional
            const thumbnailUrl = req.file ? req.file.path : "";

            const client = new DriveGallery({
                name,
                thumbnail: thumbnailUrl,
                passwordHash,
                clientId: clientId || null
            });

            await client.save();
            
            // TOUCH LEAD: Update Lead's timestamp for real-time dashboard activity
            // Use ID link if available, fallback to name-based search for legacy records
            let leadToUpdate = null;
            if (clientId) {
                const user = await User.findById(clientId);
                if (user && user.leadId) leadToUpdate = user.leadId;
            }
            
            if (!leadToUpdate && name) {
                const searchName = name.trim();
                const fallbackLead = await Lead.findOne({
                    name: { $regex: new RegExp('^' + searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
                });
                if (fallbackLead) leadToUpdate = fallbackLead._id;
            }

            if (leadToUpdate) {
                // UPDATE: Mark lead as 'Converted' (Delivered) and touch its timestamp
                await Lead.findByIdAndUpdate(leadToUpdate, { 
                    status: 'Converted',
                    updatedAt: new Date() 
                });
            }

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

            // TOUCH LEAD: Update Lead's timestamp for real-time dashboard activity
            // Find parent gallery first to resolve client/lead link
            const gallery = await DriveGallery.findById(clientId);
            if (gallery) {
                let leadToTouch = null;
                if (gallery.clientId) {
                    const user = await User.findById(gallery.clientId);
                    if (user && user.leadId) leadToTouch = user.leadId;
                }

                if (!leadToTouch && gallery.name) {
                    const searchName = gallery.name.trim();
                    const fallbackLead = await Lead.findOne({
                        name: { $regex: new RegExp('^' + searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
                    });
                    if (fallbackLead) leadToTouch = fallbackLead._id;
                }

                if (leadToTouch) {
                    // UPDATE: Mark lead as 'Converted' (Delivered) and touch its timestamp
                    await Lead.findByIdAndUpdate(leadToTouch, { 
                        status: 'Converted',
                        updatedAt: new Date() 
                    });
                }
            }

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
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/drive-gallery/proxy/:fileId
 * @desc    Proxy file request from Google Drive (Service Account auth)
 *          Supports Range headers for video seeking.
 */
router.get('/proxy/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const drive = GoogleDriveService.getDriveClient();
        if (!drive) return res.status(500).send('Drive client error');

        // Get metadata first with all-drive support
        const metadata = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, thumbnailLink',
            supportsAllDrives: true
        });

        const mimeType = metadata.data.mimeType;
        const fileSize = parseInt(metadata.data.size);
        const fileName = metadata.data.name;
        const isHEIC =
            mimeType === 'image/heic' ||
            fileName?.toLowerCase().endsWith('.heic') ||
            fileName?.toLowerCase().endsWith('.heif');

        // CASE 1: REDIRECT TO THUMBNAIL (For HEIC/Reliable Previews)
        // We use a redirect for thumbnails because it's significantly more reliable on varied network setups
        if ((req.query.thumbnail === 'true' || isHEIC) && metadata.data.thumbnailLink) {
            let highResThumbnail = metadata.data.thumbnailLink;
            if (highResThumbnail.includes('=s')) {
                highResThumbnail = highResThumbnail.replace(/=s\d+/, '=s1000');
            } else if (highResThumbnail.includes('=w')) {
                highResThumbnail = highResThumbnail.replace(/=w\d+/, '=w1000').replace(/=h\d+/, '=h1000');
            } else if (!highResThumbnail.includes('=')) {
                highResThumbnail += '=s1000';
            }

            console.log(`📡 Redirecting ${fileId} to high-res thumbnail: ${fileName}`);
            return res.redirect(302, highResThumbnail);
        }

        // CASE 2: PROXY RAW FILE (For Video Streaming/Downloads)
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const response = await drive.files.get(
                { fileId, alt: 'media', supportsAllDrives: true },
                {
                    responseType: 'stream',
                    headers: { Range: `bytes=${start}-${end}` }
                }
            );

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType,
                'Content-Disposition': `inline; filename="${fileName}"`
            });
            return response.data.pipe(res);
        } else {
            const response = await drive.files.get(
                { fileId, alt: 'media', supportsAllDrives: true },
                { responseType: 'stream' }
            );

            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
                'Content-Disposition': `inline; filename="${fileName}"`,
                'Cache-Control': 'public, max-age=86400'
            });
            return response.data.pipe(res);
        }
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).send('Error streaming file');
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
 * @route   POST /api/drive-gallery/verify/search
 * @desc    Search for a gallery by client name and verify password
 */
router.post('/verify/search', async (req, res) => {
    try {
        const { password, clientName, clientId } = req.body;

        let client;

        // Priority 1: Search by direct Account ID
        if (clientId) {
            client = await DriveGallery.findOne({ clientId });
        }

        // Priority 2: Fallback to string matching for legacy/unlinked clients
        if (!client && clientName) {
            client = await DriveGallery.findOne({
                name: { $regex: new RegExp('^' + clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            });
        }

        if (!client) {
            return res.status(404).json({ error: "No gallery collection found for this account" });
        }

        // If no password set, access is granted
        if (!client.passwordHash) {
            return res.json({ success: true, message: "Access granted" });
        }

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const isMatch = await bcrypt.compare(password, client.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid access password" });
        }

        res.json({ success: true, message: "Authorized", id: client._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/drive-gallery/verify/:id
 * @desc    Verify gallery password for client access
 */
router.post('/verify/:id', async (req, res) => {
    try {
        const { password } = req.body;
        const client = await DriveGallery.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ error: "Client collection not found" });
        }

        // If no password set, access is granted
        if (!client.passwordHash) {
            return res.json({ success: true, message: "Access granted (no password required)" });
        }

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const isMatch = await bcrypt.compare(password, client.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid access password" });
        }

        res.json({ success: true, message: "Authorized access granted" });
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
        const { name, password, clientId } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (req.file) updateData.thumbnail = req.file.path;
        if (clientId) updateData.clientId = clientId;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.passwordHash = await bcrypt.hash(password, salt);
        }

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
