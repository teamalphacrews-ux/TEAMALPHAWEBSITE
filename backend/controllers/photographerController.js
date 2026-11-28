const mongoose = require('mongoose');
const Event = require('../models/Event');
const Photographer = require('../models/Photographer');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const { fail } = require('../services/studioSecurity');
const { withRecordDeletion } = require('../services/studioArchiveGate');

const getPhotographers = async (req, res) => {
    try {
        const photographers = await Photographer.find().sort({ createdAt: -1 });
        res.status(200).json(photographers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createPhotographer = async (req, res) => {
    const photographer = req.body;
    const newPhotographer = new Photographer(photographer);
    try {
        await newPhotographer.save();
        res.status(201).json(newPhotographer);
    } catch (error) {
        res.status(409).json({ message: error.message });
    }
};

const deletePhotographer = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid crew member id.' });
    try {
        const removed = await withRecordDeletion(() => require('../services/studioRecovery').recoverableDelete({
            Model: Photographer,
            filter: { _id: id },
            actorId: req.user.id,
            beforeDelete: async ({ row, session }) => {
                const escapedName = String(row.name || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const name = new RegExp(`^\\s*${escapedName}\\s*$`, 'i');
                const hasAssignments = await Task.exists({ assignee: row._id }).session(session)
                    || (escapedName && (await Event.exists({ teamMembers: name }).session(session)
                        || await Lead.exists({ people: name }).session(session)));
                if (hasAssignments) throw fail('This crew member still has assignments. Remove them from Calendar, projects and tasks first, or set their status to Inactive to keep the assignment history.', 409);
            }
        }));
        if (!removed) return res.status(404).json({ message: 'Crew member not found.' });
        res.status(200).json({ message: 'Crew member deleted.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'The crew member could not be removed.' });
    }
};

const updatePhotographer = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, specialty, status } = req.body;
    try {
        const updatedPhotographer = await Photographer.findByIdAndUpdate(id, { name, email, phone, specialty, status, _id: id }, { new: true });
        res.status(200).json(updatedPhotographer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPhotographerWorks = async (req, res) => {
    const { name } = req.params;
    try {
        const works = await Lead.find({
            people: name
        }).sort({ eventDate: -1 }); // Sort by newest first
        res.status(200).json(works);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPhotographers,
    createPhotographer,
    deletePhotographer,
    updatePhotographer,
    getPhotographerWorks
};
