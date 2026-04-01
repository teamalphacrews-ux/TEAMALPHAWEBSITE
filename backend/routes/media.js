const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Media = require('../models/Media');
const GoogleDriveService = require('../services/googleDriveService');
const auth = require('../middleware/auth');

// Multer storage for temporary local upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

/**
 * @route   POST /api/media/upload
 * @desc    Upload file to Google Drive and save metadata
 * @access  Private/Admin
 */
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }

        const { clientId, name } = req.body;
        if (!clientId) {
            return res.status(400).json({ error: "clientId is required" });
        }

        const fileName = name || req.file.originalname;

        // Upload to Google Drive
        const googleFile = await GoogleDriveService.uploadFile(req.file, fileName);

        // Save metadata in MongoDB
        const media = new Media({
            fileId: googleFile.id,
            name: googleFile.name,
            mimeType: googleFile.mimeType,
            createdTime: googleFile.createdTime,
            thumbnail: googleFile.thumbnailLink,
            clientId: clientId,
            tags: req.body.tags ? JSON.parse(req.body.tags) : []
        });

        await media.save();

        // Remove temporary file from local storage
        fs.unlinkSync(req.file.path);

        res.status(201).json(media);
    } catch (error) {
        console.error('Upload API Error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/media/files
 * @desc    Get all media files
 * @access  Private
 */
router.get('/files', auth, async (req, res) => {
    try {
        const files = await Media.find().sort({ createdTime: -1 });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/media/files/:clientId
 * @desc    Get files by clientId
 * @access  Private
 */
router.get('/files/:clientId', auth, async (req, res) => {
    try {
        const { clientId } = req.params;
        const files = await Media.find({ clientId: clientId }).sort({ createdTime: -1 });
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   DELETE /api/media/:fileId
 * @desc    Delete file from Drive and DB
 * @access  Private/Admin
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) {
            return res.status(404).json({ error: "Media not found" });
        }

        // Delete from Drive
        await GoogleDriveService.deleteFile(media.fileId);

        // Delete from DB
        await Media.findByIdAndDelete(req.params.id);

        res.json({ message: "Media deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   POST /api/media/drive-collection
 * @desc    Add a Google Drive folder as a collection
 */
router.post('/drive-collection', auth, async (req, res) => {
    try {
        const { driveLink, clientId } = req.body;
        if (!driveLink || !clientId) {
            return res.status(400).json({ error: "driveLink and clientId are required" });
        }

        const folderId = GoogleDriveService.extractFolderId(driveLink);
        if (!folderId) {
            return res.status(400).json({ error: "Invalid Google Drive link" });
        }

        // Store as a special Media entry or just fetch and return
        // For simplicity, we'll store a "Folder" type entry in Media
        const media = new Media({
            fileId: folderId,
            name: req.body.name || "Drive Collection",
            mimeType: "application/vnd.google-apps.folder",
            clientId: clientId,
            createdTime: new Date()
        });

        await media.save();
        res.status(201).json(media);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route   GET /api/media/folder/:folderId
 * @desc    Fetch contents of a Drive folder
 */
router.get('/folder/:folderId', auth, async (req, res) => {
    try {
        const { folderId } = req.params;
        const contents = await GoogleDriveService.getFolderContents(folderId);
        res.json(contents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
