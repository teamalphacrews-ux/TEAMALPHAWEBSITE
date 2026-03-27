const express = require('express');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const auth = require('../middleware/auth');

const router = express.Router();

// GET all tasks (global)
router.get('/', auth, async (req, res) => {
    try {
        const tasks = await Task.find().populate('lead').sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a global task (no lead)
router.post('/', auth, async (req, res) => {
    try {
        const task = new Task(req.body);
        await task.save();
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH update task (status or title)
router.patch('/:id', auth, async (req, res) => {
    try {
        const { title, status, dueDate } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: "Task not found" });

        if (title !== undefined) task.title = title;
        if (dueDate !== undefined) task.dueDate = dueDate;
        
        if (status !== undefined) {
            task.status = status;
        } else if (title === undefined && dueDate === undefined) {
            // Legacy/Toggle behavior if no fields provided
            task.status = task.status === 'completed' ? 'pending' : 'completed';
        }

        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE task
router.delete('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (task && task.lead) {
            await Lead.findByIdAndUpdate(task.lead, { $pull: { tasks: req.params.id } });
        }
        res.json({ message: "Task deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
