const router = require("express").Router();
const {
  acceptedQuote,
  projectView,
  messages,
  saveMessage,
} = require("../services/clientProject");
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res
      .status(error.status || 503)
      .json({
        error: error.status
          ? error.message
          : "Your project could not be loaded. Please retry.",
      });
  }
};
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  next();
});
router.get(
  "/:token/project",
  wrap(async (req, res) =>
    res.json(await projectView(await acceptedQuote(req.params.token))),
  ),
);
router.get(
  "/:token/messages",
  wrap(async (req, res) => {
    const quote = await acceptedQuote(req.params.token);
    res.json(await messages(quote._id, req.query?.before));
  }),
);
router.post(
  "/:token/messages",
  wrap(async (req, res) =>
    res
      .status(201)
      .json(
        await saveMessage(
          await acceptedQuote(req.params.token),
          "client",
          req.body,
        ),
      ),
  ),
);
module.exports = router;
