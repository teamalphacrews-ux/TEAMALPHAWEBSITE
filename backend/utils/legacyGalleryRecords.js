const Gallery = require('../models/Gallery');
const Event = require('../models/Event');
const Lease = require('../models/StudioOperationLease');

function storedValue(value, fallback) {
    return value == null || value === fallback ? { $in: [fallback, null] } : value;
}

function folderFilter(folder) {
    return { clientFolder: storedValue(folder, 'Default Client') };
}

function groupFilter(folder, category) {
    return { ...folderFilter(folder), category: storedValue(category, 'Wedding') };
}

// Cover edits may involve two new images, so locking an existing gallery image
// would miss simultaneous first covers. This row belongs to this workspace.
async function withGalleryWrite(work, affectsCovers = true) {
    const lock = { _id: 'gallery:covers' };
    if (affectsCovers) {
        const now = new Date();
        try {
            await Lease.updateOne(lock, { $setOnInsert: { revision: 0, until: now, expiresAt: new Date(+now + 86400000) } }, { upsert: true });
        } catch (err) {
            if (err.code !== 11000 || err.keyValue?._id !== lock._id) throw err;
        }
    }
    return Gallery.db.transaction(async session => {
        if (affectsCovers) {
            const now = new Date();
            await Lease.updateOne(lock, { $inc: { revision: 1 }, $set: { until: now, expiresAt: new Date(+now + 86400000) } }, { upsert: true, session });
        }
        return work(session);
    });
}

function clearOtherCovers(group, keep, session) {
    return Gallery.updateMany({ ...group, _id: { $ne: keep }, isCover: true }, { $set: { isCover: false } }, { session });
}

async function chooseCover(item, session) {
    await clearOtherCovers(groupFilter(item.clientFolder, item.category), item._id, session);
    if (!item.isCover) {
        item.isCover = true;
        await item.save({ session, validateModifiedOnly: true });
    }
    return item;
}

async function moveGalleryItems(filter, changes) {
    return withGalleryWrite(async session => {
        const covers = await Gallery.find({ ...filter, isCover: true }).select('clientFolder category').sort({ _id: 1 }).session(session);
        const destinations = new Map();
        for (const source of covers) {
            const folder = changes.clientFolder ?? source.clientFolder;
            const category = changes.category ?? source.category;
            const key = JSON.stringify([folder, category]);
            if (destinations.has(key)) continue;
            const group = groupFilter(folder, category);
            const current = await Gallery.findOne({ ...group, isCover: true }).select('_id').sort({ _id: 1 }).session(session);
            destinations.set(key, { group, keep: current?._id || source._id });
        }
        await Gallery.updateMany(filter, { $set: changes }, { session });
        // A folder/category rename can merge existing groups. Prefer the destination's cover.
        for (const { group, keep } of destinations.values()) await clearOtherCovers(group, keep, session);
    });
}

async function deleteGalleryItems(filter) {
    return Gallery.db.transaction(async session => {
        // Bound each command size even for large folders. Only items from this
        // transaction's snapshot are removed from the gallery and calendar.
        let items;
        do {
            items = await Gallery.find(filter).select('_id').limit(500).session(session).lean();
            if (!items.length) break;
            const ids = items.map(item => item._id);
            await Gallery.deleteMany({ _id: { $in: ids } }, { session });
            await Event.updateMany({ photos: { $in: ids } }, { $pull: { photos: { $in: ids } } }, { session });
        } while (items.length === 500);
    });
}

module.exports = { withGalleryWrite, chooseCover, moveGalleryItems, deleteGalleryItems, folderFilter, groupFilter };
