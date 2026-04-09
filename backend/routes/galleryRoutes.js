const express = require('express');
const Gallery = require('../models/Gallery');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const CloudinaryStorageModule = require('multer-storage-cloudinary');
const CloudinaryStorage = CloudinaryStorageModule.CloudinaryStorage || CloudinaryStorageModule;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'team-alpha-gallery',
        resource_type: 'auto'
    },
});

const upload = multer({ storage });

router.post('/upload', auth, (req, res, next) => {
    upload.single('file')(req, res, async function (err) {
        if (err) {
            console.error("Multer upload error full details:", JSON.stringify(err, null, 2));
            return res.status(500).json({ error: err.message || JSON.stringify(err) || 'Upload failed' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Notification for upload
        await Notification.create({
            title: "New Media Uploaded",
            description: `A new file (${Math.round(req.file.size / 1024)} KB) has been uploaded to the gallery registry.`,
            type: "Gallery"
        });

        res.json({ url: req.file.path, size: req.file.size });
    });
});

router.get('/', auth, async (req, res) => {
    try {
        const items = await Gallery.find().sort({ uploadedAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const item = new Gallery(req.body);
        await item.save();

        const Event = require('../models/Event');
        const event = await Event.findOne({ title: item.category });
        if (event) {
            if (!event.photos) event.photos = [];
            event.photos.push(item._id);
            await event.save();
        }

        await Notification.create({
            title: "Gallery Registry Updated",
            description: `New item added to ${item.clientFolder || 'Default'} - ${item.category || 'General'}${item.driveName ? ` in Drive: ${item.driveName}` : ''}.`,
            type: "Gallery"
        });

        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create gallery item' });
    }
});

router.patch('/:id/favorite', auth, async (req, res) => {
    try {
        const item = await Gallery.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        item.isFavorite = !item.isFavorite;
        await item.save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update favorite status' });
    }
});

router.patch('/:id/select', auth, async (req, res) => {
    try {
        const item = await Gallery.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        item.isSelected = !item.isSelected;
        await item.save();
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update selected status' });
    }
});

router.patch('/:id/cover', auth, async (req, res) => {
    try {
        const item = await Gallery.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        await Gallery.updateMany(
            { clientFolder: item.clientFolder, category: item.category },
            { $set: { isCover: false } }
        );

        item.isCover = true;
        await item.save();
        res.json({ message: 'Cover updated', item });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update cover' });
    }
});

router.patch('/rename-folder', auth, async (req, res) => {
    const { oldName, newName } = req.body;
    try {
        const query = oldName === 'Default Client'
            ? { $or: [{ clientFolder: oldName }, { clientFolder: { $exists: false } }, { clientFolder: null }] }
            : { clientFolder: oldName };
        await Gallery.updateMany(query, { clientFolder: newName });
        res.json({ message: 'Folder renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});

router.patch('/rename-category', auth, async (req, res) => {
    const { clientFolder, oldCategory, newCategory } = req.body;
    try {
        const folderQuery = clientFolder === 'Default Client'
            ? { $in: ['Default Client', null] }
            : clientFolder;

        await Gallery.updateMany(
            { clientFolder: folderQuery, category: oldCategory },
            { category: newCategory }
        );
        res.json({ message: 'Category renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename category' });
    }
});

router.patch('/:id', auth, async (req, res) => {
    try {
        const item = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update item' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        await Gallery.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

router.delete('/folder/:folderName', auth, async (req, res) => {
    try {
        const folderName = req.params.folderName;
        const query = folderName === 'Default Client'
            ? { $or: [{ clientFolder: folderName }, { clientFolder: { $exists: false } }, { clientFolder: null }] }
            : { clientFolder: folderName };
        await Gallery.deleteMany(query);
        res.json({ message: 'Folder deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

router.delete('/folder/:folderName/category/:categoryName', auth, async (req, res) => {
    try {
        const { folderName, categoryName } = req.params;
        const folderQuery = folderName === 'Default Client'
            ? { $in: ['Default Client', null] }
            : folderName;

        await Gallery.deleteMany({ clientFolder: folderQuery, category: categoryName });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

module.exports = router;
