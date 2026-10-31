const router = require("express").Router();
const mongoose = require("mongoose");
const Quotation = require("../models/Quotation");
const ProjectMessage = require("../models/ProjectMessage");
const {
  messages,
  saveMessage,
  publicMessage,
} = require("../services/clientProject");
router.use(
  require("../middleware/auth"),
  require("../middleware/requireAdmin"),
);
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    res.status(error.status || 503).json({
      error: error.status
        ? error.message
        : "Client support is unavailable. Please retry.",
    });
  }
};
async function load(id) {
  const quote = mongoose.isValidObjectId(id)
    ? await Quotation.findById(id).select("+shareToken")
    : null;
  if (!quote)
    throw Object.assign(new Error("Project conversation not found."), {
      status: 404,
    });
  return quote;
}
router.get(
  "/",
  wrap(async (req, res) => {
    const quotes = await Quotation.find({ status: "Accepted" })
      .sort({ acceptedAt: -1 })
      .select("clientName title documentNumber");
    const summaries = await ProjectMessage.aggregate([
      { $match: { quotation: { $in: quotes.map((quote) => quote._id) } } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$quotation",
          latestMessage: {
            $first: {
              _id: "$_id",
              author: "$author",
              text: "$text",
              createdAt: "$createdAt",
            },
          },
          clientUnread: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$author", "client"] },
                    { $ne: ["$studioRead", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const byQuote = new Map(
      summaries.map((summary) => [String(summary._id), summary]),
    );
    res.json(
      quotes
        .map((quote) => {
          const thread = byQuote.get(String(quote._id));
          return {
            _id: quote._id,
            clientName: quote.clientName,
            title: quote.title,
            documentNumber: quote.documentNumber,
            latestMessage: thread?.latestMessage
              ? publicMessage(thread.latestMessage)
              : null,
            clientUnread: thread?.clientUnread || 0,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.latestMessage?.createdAt || 0) -
            new Date(a.latestMessage?.createdAt || 0),
        ),
    );
  }),
);
router.get(
  "/unread",
  wrap(async (req, res) => {
    const quotes = await Quotation.find({ status: "Accepted" }).select("_id");
    res.json({
      count: await ProjectMessage.countDocuments({
        quotation: { $in: quotes.map((quote) => quote._id) },
        author: "client",
        studioRead: { $ne: true },
      }),
    });
  }),
);
router.get(
  "/:id/messages",
  wrap(async (req, res) => {
    const quote = await load(req.params.id);
    const result = await messages(quote._id, req.query?.before);
    await ProjectMessage.updateMany(
      {
        _id: {
          $in: result.messages
            .filter((message) => message.author === "client")
            .map((message) => message._id),
        },
        quotation: quote._id,
        author: "client",
        studioRead: { $ne: true },
      },
      { $set: { studioRead: true } },
    );
    const clientUnread = await ProjectMessage.countDocuments({
      quotation: quote._id,
      author: "client",
      studioRead: { $ne: true },
    });
    let clientUrl = null;
    if (quote.status === "Accepted" && quote.shareToken)
      try {
        clientUrl =
          require("../services/studioMailer").frontendOrigin() +
          "/quote/" +
          quote.shareToken;
      } catch {
        /* a configured origin is optional for reading */
      }
    res.json({
      ...result,
      clientUnread,
      quote: {
        clientName: quote.clientName,
        title: quote.title,
        documentNumber: quote.documentNumber,
        invoiceId: quote.invoiceId,
      },
      clientUrl,
    });
  }),
);
router.post(
  "/:id/messages",
  wrap(async (req, res) => {
    const quote = await load(req.params.id);
    if (quote.status !== "Accepted")
      return res
        .status(409)
        .json({ error: "This client conversation is closed." });
    res.status(201).json(await saveMessage(quote, "studio", req.body));
  }),
);
module.exports = router;
