const router = require("express").Router();
const Task = require("../models/Task");
const Lead = require("../models/Lead");
const { taskValues, validateTaskLinks } = require("../utils/productionTask");
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
  "/",
  wrap(async (req, res) => {
    const values = taskValues(req.body);
    await validateTaskLinks(values);
    const task = await Task.create(values);
    if (task.lead)
      await Lead.updateOne(
        { _id: task.lead },
        { $addToSet: { tasks: task._id } },
      );
    res.status(201).json(task);
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
    const task = await Task.findByIdAndDelete(req.params.id);
    if (task?.lead)
      await Lead.updateOne({ _id: task.lead }, { $pull: { tasks: task._id } });
    res.json({ message: "Task deleted." });
  }),
);
module.exports = router;
