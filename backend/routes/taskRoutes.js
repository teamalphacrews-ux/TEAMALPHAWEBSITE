const router = require("express").Router();
const { manualCreation } = require('../utils/manualCreation');
const Task = require("../models/Task");
const { taskValues, validateTaskLinks, createProductionTask } = require("../utils/productionTask");
router.use(
  require("../middleware/auth"),
  require("../middleware/requireAdmin"),
);
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res
      .status(error.status || (error.name === "CastError" ? 404 : 503))
      .json({
        error: error.status
          ? error.message
          : "Production tasks are unavailable. Please retry.",
      });
  }
};
router.get(
  "/",
  wrap(async (req, res) =>
    res.json(
      await Task.find()
        .populate("lead")
        .populate("assignee", "name specialty")
        .sort({ createdAt: -1 }),
    ),
  ),
);
router.post(
  '/apply-template',
  wrap(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.body?.leadId || '') || typeof req.body?.templateId !== 'string')
      throw Object.assign(new Error('Choose a project and a production template.'), { status: 400 });
    res.json(await require('../services/productionTemplates').applyProductionTemplate(req.body.leadId, req.body.templateId));
  }),
);
router.post(
  "/",
  wrap(async (req, res) => {
    const { record, replayed } = await manualCreation(req, Task, session => createProductionTask(req.body, session));
    res.status(replayed ? 200 : 201).json(record);
  }),
);
router.patch(
  "/:id",
  wrap(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found." });
    const body =
      req.body && Object.keys(req.body).length
        ? req.body
        : { status: task.status === "completed" ? "pending" : "completed" };
    const values = taskValues({ ...body, lead: task.lead }, task.toObject());
    await validateTaskLinks(values);
    Object.assign(task, values);
    res.json(await task.save());
  }),
);
router.delete(
  "/:id",
  wrap(async (req, res) => {
    await require('../services/studioRecovery').recoverableDelete({ Model: Task, filter: { _id: req.params.id }, actorId: req.user.id });
    res.json({ message: "Task deleted." });
  }),
);
module.exports = router;
