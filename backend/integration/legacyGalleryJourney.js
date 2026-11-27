const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Event = require('../models/Event');
const Gallery = require('../models/Gallery');
const DriveGallery = require('../models/DriveGallery');
const GalleryEvent = require('../models/GalleryEvent');
const { openSession } = require('../services/studioSecurity');

module.exports = async function legacyGalleryJourney(t, port, secret, request) {
  // The legacy administration routes operate in the default database.
  await mongoose.connect('mongodb://127.0.0.1:' + port + '/audit_registry?replicaSet=studioAudit');
  try {
    const admin = await User.create({
      firstName: 'Test', email: 'legacy@example.test', password: randomBytes(32).toString('hex'),
      role: 'admin', studioOwner: true,
    });
    const token = await openSession(admin, { headers: {} }, jwt.sign, secret);
    const first = await Lead.create({ name: 'Same Name', email: 'one@example.test' });
    const second = await Lead.create({ name: 'Same Name', email: 'two@example.test' });
    const dates = { start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T11:00:00Z') };
    const firstEvent = await Event.create({ title: 'Wedding', lead: first._id, ...dates });
    const secondEvent = await Event.create({ title: 'Wedding', lead: second._id, ...dates });
    const photo = await Gallery.create({ albumName: 'Same Name', url: 'https://example.test/one.jpg' });
    await Event.updateOne({ _id: secondEvent._id }, { $set: { photos: [photo._id, photo._id] } });

    await t.test('recent activity links galleries to recorded identities and counts distinct linked images', async () => {
      const drive = await DriveGallery.create({ name: 'Same Name' });
      const folder = await GalleryEvent.create({ clientId: drive._id, name: 'Album', driveFolderId: 'test-folder' });
      const activity = () => request('GET', '/dashboard/recent-activity', token);
      const rows = await activity();
      assert.equal(rows.find(row => row._id === String(folder._id))?.isLead, false);
      assert.equal(rows.find(row => row._id === String(first._id)).count, '0 photos');
      assert.equal(rows.find(row => row._id === String(second._id)).count, '1 photo');
      const client = await User.create({
        firstName: 'Client', email: 'gallery@example.test', password: randomBytes(32).toString('hex'), leadId: second._id,
      });
      await DriveGallery.updateOne({ _id: drive._id }, { clientId: client._id });
      const linked = await activity();
      assert.equal(linked.find(row => row._id === String(second._id)).name, 'Album for Same Name');
      assert.equal(linked.find(row => row._id === String(second._id)).isLead, true);
      await GalleryEvent.create({ clientId: drive._id, name: 'Older folder', driveFolderId: 'older-folder',
        createdAt: new Date(folder.createdAt.getTime() - 1) });
      assert.equal((await activity()).find(row => row._id === String(second._id)).name, 'Album for Same Name');
    });

    await t.test('gallery creation links only the specified calendar event', async () => {
      const body = { albumName: 'Sample', clientFolder: 'Example', category: 'Wedding', url: 'https://example.test/two.jpg' };
      await request('POST', '/gallery', token, body);
      const item = await request('POST', '/gallery', token, { ...body, eventId: String(secondEvent._id) });
      assert.equal((await Event.findById(firstEvent._id)).photos.length, 0);
      assert.ok((await Event.findById(secondEvent._id)).photos.some(id => String(id) === item._id));
      await request('POST', '/gallery', token, { ...body, eventId: String(new mongoose.Types.ObjectId()) }, 404);
      assert.equal(await Gallery.countDocuments({ albumName: 'Sample' }), 2);
    });

    await t.test('desired selection and favorite states can be retried and cleared', async () => {
      for (const [suffix, key] of [['select', 'isSelected'], ['favorite', 'isFavorite']]) {
        const update = (body, status) => request('PATCH', '/gallery/' + photo._id + '/' + suffix, token, body, status);
        for (const value of [true, true, false, false]) {
          assert.equal((await update({ [key]: value }))[key], value);
        }
        const concurrent = await Promise.all([update({ [key]: true }), update({ [key]: true })]);
        assert.ok(concurrent.every(item => item[key] === true));
        await update({ [key]: 'false' }, 400);
        assert.equal((await Gallery.findById(photo._id))[key], true);
        assert.equal((await update({}))[key], false);
      }
    });
    await t.test('repeated and simultaneous cover changes retain one cover in the folder', async () => {
      for (let i = 0; i < 2; i++) await request('PATCH', '/gallery/' + photo._id + '/cover', token, {});
      assert.equal((await Gallery.findById(photo._id)).isCover, true);
      const other = await Gallery.create({ albumName: 'Same Name', url: 'https://example.test/three.jpg' });
      await Promise.all([photo, other].map(item => request('PATCH', '/gallery/' + item._id + '/cover', token, {})));
      assert.equal(await Gallery.countDocuments({ clientFolder: 'Default Client', category: 'Wedding', isCover: true }), 1);
    });
    await t.test('create, edit, move, and merge preserve one cover per folder and category', async () => {
      const add = (folder, category = 'Wedding') => request('POST', '/gallery', token, {
        clientFolder: folder, category, albumName: 'Proofs', url: 'https://example.test/cover.jpg', isCover: true,
      });
      const covers = async (folder, category = 'Wedding') =>
        (await Gallery.find({ clientFolder: folder, category, isCover: true }).select('_id')).map(item => String(item._id));
      const [one, two] = await Promise.all([add('Proofs'), add('Proofs')]);
      assert.equal((await covers('Proofs')).length, 1);
      await request('PATCH', '/gallery/' + one._id, token, { isCover: true });
      assert.deepEqual(await covers('Proofs'), [one._id]);
      await add('Final');
      await request('PATCH', '/gallery/' + one._id, token, { clientFolder: 'Final' });
      assert.deepEqual(await covers('Final'), [one._id]);
      await request('PATCH', '/gallery/' + two._id, token, { isCover: true });
      await request('PATCH', '/gallery/rename-folder', token, { oldName: 'Proofs', newName: 'Final' });
      assert.deepEqual(await covers('Final'), [one._id]);
      const otherCategory = await add('Final', 'Reception');
      await request('PATCH', '/gallery/rename-category', token, { clientFolder: 'Final', oldCategory: 'Wedding', newCategory: 'Reception' });
      assert.deepEqual(await covers('Final', 'Reception'), [otherCategory._id]);
    });
    await t.test('item, category and folder deletion remove only their calendar photo references', async () => {
      const add = (folder, category) => Gallery.create({
        clientFolder: folder, category, albumName: 'Test images', url: 'https://example.test/test.jpg',
      });
      const one = await add('Delete', 'Wedding');
      const two = await add('Delete', 'Wedding');
      const three = await add('Delete', 'Reception');
      const keep = await add('Keep', 'Wedding');
      const event = await Event.create({
        title: 'Gallery fixture', ...dates, photos: [one._id, one._id, two._id, three._id, keep._id],
      });
      await Event.updateOne({ _id: firstEvent._id }, { $push: { photos: one._id } });
      const ids = async () => (await Event.findById(event._id)).photos.map(String);
      // Reject the event update after gallery deletion to exercise transaction rollback.
      const db = mongoose.connection.db;
      await db.command({ collMod: Event.collection.name, validator: { $or: [
        { _id: { $ne: event._id } }, { photos: { $size: 5 } },
      ] } });
      try {
        await request('DELETE', '/gallery/' + one._id, token, null, 500);
        assert.ok(await Gallery.findById(one._id));
        assert.equal((await ids()).length, 5);
      } finally {
        await db.command({ collMod: Event.collection.name, validator: {} });
      }
      await request('DELETE', '/gallery/' + one._id, token);
      assert.deepEqual(await ids(), [two, three, keep].map(item => String(item._id)));
      assert.equal((await Event.findById(firstEvent._id)).photos.length, 0);
      await request('DELETE', '/gallery/folder/Delete/category/Wedding', token);
      assert.deepEqual(await ids(), [three, keep].map(item => String(item._id)));
      await request('DELETE', '/gallery/folder/Delete', token);
      await request('DELETE', '/gallery/folder/Delete', token);
      assert.deepEqual(await ids(), [String(keep._id)]);
      assert.equal(await Gallery.countDocuments({ clientFolder: 'Delete' }), 0);
      assert.equal(await Gallery.countDocuments({ clientFolder: 'Keep' }), 1);
    });
  } finally {
    await mongoose.disconnect();
  }
};
