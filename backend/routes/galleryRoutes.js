const express = require('express');
const Gallery = require('../models/Gallery');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { withGalleryWrite, chooseCover, moveGalleryItems, deleteGalleryItems, folderFilter, groupFilter } = require('../utils/legacyGalleryRecords');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('../storage/cloudinaryStorage');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

router.use(auth, requireAdmin);
router.use((req, res, next) => req.method === 'DELETE' ? require('../services/studioSecurity').requirePermission('deletion')(req, res, next) : next());

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'team-alpha-gallery',
        resource_type: 'auto'
    },
});

const upload = multer({ storage });

router.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, async function (err) {
        if (err) {
            console.error('Gallery media upload failed.');
            return res.status(500).json({ error: 'Unable to upload the media file.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        try {
            await Notification.create({
                title: "New Media Uploaded",
                description: `A new file (${Math.round(req.file.size / 1024)} KB) has been uploaded to the gallery registry.`,
                type: "Gallery"
            });
        } catch {
            console.warn('Uploaded media could not be recorded in studio activity.');
        }

        res.json({ url: req.file.path, size: req.file.size });
    });
});

router.get('/', async (req, res) => {
    try {
        const items = await Gallery.find().sort({ uploadedAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});

router.post('/', async (req, res) => {
    const { eventId, ...values } = req.body || {};
    if (eventId != null && (typeof eventId !== 'string' || !/^[a-f\d]{24}$/i.test(eventId))) {
        return res.status(400).json({ error: 'Choose a valid calendar event' });
    }
    try {
        const { item, note } = await withGalleryWrite(async session => {
            const [created] = await Gallery.create([values], { session });
            if (created.isCover) await chooseCover(created, session);
            if (eventId) {
                const event = await Event.updateOne({ _id: eventId }, { $addToSet: { photos: created._id } }, { session });
                if (!event.matchedCount) throw Object.assign(new Error('Calendar event not found'), { status: 404 });
            }
            // Store the activity atomically, then notify devices after the transaction commits.
            const [note] = await Notification.insertMany([{
                title: "Gallery Registry Updated",
                description: `New item added to ${created.clientFolder || 'Default'} - ${created.category || 'General'}${created.driveName ? ` in Drive: ${created.driveName}` : ''}.`,
                type: "Gallery"
            }], { session });
            return { item: created, note };
        }, Boolean(values.isCover));
        void require('../services/studioPush').deliverNotification(note).catch(() => {});
        res.json(item);
    } catch (err) {
        if (err.status === 404) return res.status(404).json({ error: err.message });
        if (err.name === 'ValidationError') return res.status(400).json({ error: 'Check the gallery item details' });
        res.status(500).json({ error: 'Failed to create gallery item' });
    }
});

function updateGalleryFlag(field) {
    return async (req, res) => {
        const body = req.body || {};
        const toggle = Object.keys(body).length === 0;
        if (!toggle && typeof body[field] !== 'boolean') {
            return res.status(400).json({ error: `Provide a boolean ${field}` });
        }
        if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Item not found' });
        try {
            // Older callers toggle with an empty body. Specifying a desired state is retry-safe.
            const update = toggle
                ? [{ $set: { [field]: { $not: [{ $ifNull: ['$' + field, false] }] } } }]
                : { $set: { [field]: body[field] } };
            const item = await Gallery.findByIdAndUpdate(req.params.id, update, { new: true });
            if (!item) return res.status(404).json({ error: 'Item not found' });
            res.json(item);
        } catch {
            res.status(500).json({ error: 'Failed to update gallery item' });
        }
    };
}
router.patch('/:id/favorite', updateGalleryFlag('isFavorite'));
router.patch('/:id/select', updateGalleryFlag('isSelected'));

router.patch('/:id/cover', async (req, res) => {
    try {
        const item = await withGalleryWrite(async session => {
            const target = await Gallery.findById(req.params.id).session(session);
            return target ? chooseCover(target, session) : null;
        });
        if (!item) return res.status(404).json({ error: 'Item not found' });

        res.json({ message: 'Cover updated', item });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update cover' });
    }
});

router.patch('/rename-folder', async (req, res) => {
    const { oldName, newName } = req.body || {};
    if (![oldName, newName].every(value => typeof value === 'string' && value.trim())) {
        return res.status(400).json({ error: 'Enter the current and new folder names' });
    }
    try {
        await moveGalleryItems(folderFilter(oldName), { clientFolder: newName });
        res.json({ message: 'Folder renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});

router.patch('/rename-category', async (req, res) => {
    const { clientFolder, oldCategory, newCategory } = req.body || {};
    if (![clientFolder, oldCategory, newCategory].every(value => typeof value === 'string' && value.trim())) {
        return res.status(400).json({ error: 'Enter the folder and both category names' });
    }
    try {
        await moveGalleryItems(groupFilter(clientFolder, oldCategory), { category: newCategory });
        res.json({ message: 'Category renamed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename category' });
    }
});

router.patch('/:id', async (req, res) => {
    const supplied = req.body && Object.keys(req.body).length === 1 && Object.hasOwn(req.body, '$set') ? req.body.$set : req.body;
    if (!supplied || Array.isArray(supplied) || typeof supplied !== 'object' ||
        (supplied._id != null && supplied._id !== req.params.id) || Object.keys(supplied).some(key => !Gallery.schema.path(key))) {
        return res.status(400).json({ error: 'Provide gallery item fields to update' });
    }
    const { _id, __v, createdAt, updatedAt, ...changes } = supplied;
    try {
        const changesGroup = ['clientFolder', 'category', 'isCover'].some(key => Object.hasOwn(changes, key));
        const item = await withGalleryWrite(async session => {
            const target = await Gallery.findById(req.params.id).session(session);
            if (!target) return null;
            target.set(changes);
            await target.save({ session, validateModifiedOnly: true });
            if (changesGroup && target.isCover) await chooseCover(target, session);
            return target;
        }, changesGroup);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (err) {
        if (err.name === 'ValidationError') return res.status(400).json({ error: 'Check the gallery item details' });
        res.status(500).json({ error: 'Failed to update item' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await deleteGalleryItems({ _id: req.params.id });
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

router.delete('/folder/:folderName', async (req, res) => {
    try {
        await deleteGalleryItems(folderFilter(req.params.folderName));
        res.json({ message: 'Folder deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

router.delete('/folder/:folderName/category/:categoryName', async (req, res) => {
    try {
        const { folderName, categoryName } = req.params;
        await deleteGalleryItems(groupFilter(folderName, categoryName));
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

module.exports = router;
