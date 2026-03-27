const Photographer = require('../models/Photographer');
const Lead = require('../models/Lead');

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
    try {
        await Photographer.findByIdAndDelete(id);
        res.status(200).json({ message: "Photographer deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
