const { createHash } = require("node:crypto");
const { Types } = require("mongoose");
const { overviewTimezone } = require("./studioOverviewInsights");

const PAGE_SIZE = 50;
const FILTERS = ["all", "outstanding", "overdue", "today", "upcoming", "unscheduled", "paid", "draft"];
const SORTS = {
  overdue: { overdueFirst: -1, dueOrder: 1, newest: -1, _id: 1 },
  due: { dueOrder: 1, newest: -1, _id: 1 },
  newest: { newest: -1, _id: 1 },
  balance: { outstanding: -1, dueOrder: 1, newest: -1, _id: 1 },
};
const INDEXED_NEWEST = { invoiceDate: -1, _id: 1 };
const exactOverview = { $group: { _id: null, total: { $sum: 1 }, overdue: { $sum: "$overdueFirst" } } };
const INVALID = value => Object.assign(new Error(value), { status: 400 });
const UNSET_DUE_ORDER = "9999-12-31";
const pageFields = {
  invoice: { _id: "$_id", clientName: "$clientName", title: "$title", invoiceNumber: "$invoiceNumber",
    documentNumber: "$documentNumber", invoiceDate: "$invoiceDate", createdAt: "$createdAt", currency: "$currency", total: "$total" },
  documentStatus: 1, paymentStatus: 1, balance: { $divide: ["$outstanding", 100] }, nextDue: 1, daysOverdue: 1, state: 1,
};

function registerOptions(query, now) {
  const { filter = "all", sort = "overdue", tz, q = "", cursor = "" } = query;
  if (!FILTERS.includes(filter) || typeof sort !== "string" || !Object.hasOwn(SORTS, sort) || typeof q !== "string" || q.length > 512 ||
      typeof cursor !== "string" || cursor.length > 512 || (tz !== undefined && (typeof tz !== "string" || tz.length > 80)))
    throw INVALID("Choose a valid invoice search, filter or page.");
  const timeZone = overviewTimezone(tz, tz !== undefined);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).map(part => [part.type, part.value]));
  const today = [parts.year, parts.month, parts.day].join("-");
  const search = q.trim().toLowerCase();
  const fingerprint = createHash("sha256").update(JSON.stringify([today, timeZone, search, filter, sort])).digest("base64url").slice(0, 16);
  return { filter, sort, order: SORTS[sort], search, today, cursor, fingerprint };
}

const convert = (input, to, fallback) => ({ $convert: { input, to, onError: fallback, onNull: fallback } });
const positivePaise = input => ({
  $let: {
    vars: { rounded: { $floor: { $add: [{ $multiply: [convert(input, "double", 0), 100] }, 0.5] } } },
    in: { $cond: [{ $and: [{ $gt: ["$$rounded", 0] }, { $lte: ["$$rounded", Number.MAX_SAFE_INTEGER] }] }, "$$rounded", 0] },
  },
});
const isoDay = date => ({ $dateToString: { date, format: "%Y-%m-%d", onNull: "" } });
const parseDay = dateString => ({ $dateFromString: { dateString, format: "%Y-%m-%d", onError: null, onNull: null } });

// Match the editor's date-only installment rules, including older strings.
// Round-tripping rejects malformed day values that the database may normalize.
const dueKey = input => ({
  $cond: [
    { $eq: [{ $type: input }, "date"] },
    isoDay(input),
    { $let: {
      vars: { key: { $substrCP: [convert(input, "string", ""), 0, 10] } },
      in: { $cond: [{ $eq: [isoDay(parseDay("$$key")), "$$key"] }, "$$key", ""] },
    } },
  ],
});

function registerStages(today) {
  return [
    { $project: {
      invoiceDate: 1, createdAt: 1, clientName: 1, title: 1, invoiceNumber: 1, documentNumber: 1, dueDate: 1,
      total: 1, currency: 1, status: 1, advancePaid: 1, totalPaise: positivePaise("$total"), paidPaise: positivePaise("$advancePaid"),
      newest: convert(convert({ $ifNull: ["$invoiceDate", "$createdAt"] }, "date", null), "long", 0),
      documentStatus: { $cond: [
        { $in: [{ $ifNull: ["$documentStatus", ""] }, ["", null]] },
        { $cond: [{ $eq: ["$status", "Cancelled"] }, "Cancelled", "Sent"] },
        "$documentStatus",
      ] },
      schedule: { $cond: [{ $and: [{ $eq: ["$paymentScheduleEnabled", true] }, { $isArray: "$paymentSchedule" }] }, "$paymentSchedule", []] },
    } },
    { $set: {
      inactive: { $or: [{ $in: ["$documentStatus", ["Draft", "Cancelled", "Archived"]] }, { $eq: ["$status", "Cancelled"] }] },
      schedule: {
        $map: {
          input: { $range: [0, { $size: "$schedule" }] }, as: "position",
          in: { $let: {
            vars: { item: { $arrayElemAt: ["$schedule", "$$position"] } },
            in: { position: "$$position", dueDate: dueKey("$$item.dueDate"),
              amountPaise: { $cond: [{ $isNumber: "$$item.amountPaise" }, "$$item.amountPaise", 0] }, label: { $ifNull: ["$$item.label", "Scheduled payment"] } },
          } },
        },
      },
    } },
    { $set: {
      outstanding: { $cond: [{ $or: ["$inactive", { $eq: ["$status", "Paid"] }] }, 0, { $max: [0, { $subtract: ["$totalPaise", "$paidPaise"] }] }] },
      schedule: { $cond: [{ $and: [
        { $eq: [{ $sum: "$schedule.amountPaise" }, "$totalPaise"] },
        { $gt: [{ $size: "$schedule" }, 0] },
        { $allElementsTrue: [{ $map: { input: "$schedule", as: "item", in: {
          $and: [{ $ne: ["$$item.dueDate", ""] }, { $gt: ["$$item.amountPaise", 0] }, { $eq: ["$$item.amountPaise", { $floor: "$$item.amountPaise" }] }],
        } } }] },
      ] }, { $sortArray: { input: "$schedule", sortBy: { dueDate: 1, position: 1 } } },
      [{ amountPaise: "$totalPaise", dueDate: dueKey("$dueDate"), label: "Invoice balance" }]] },
    } },
    { $set: {
      nextDue: { $cond: [{ $gt: ["$outstanding", 0] }, {
        $let: {
          vars: { allocation: { $reduce: {
            input: "$schedule", initialValue: { paid: "$paidPaise", next: null },
            in: { $cond: [
              { $ne: ["$$value.next", null] }, "$$value",
              { $cond: [
                { $gte: ["$$value.paid", "$$this.amountPaise"] },
                { paid: { $subtract: ["$$value.paid", "$$this.amountPaise"] }, next: null },
                { paid: 0, next: { amountPaise: { $subtract: ["$$this.amountPaise", "$$value.paid"] }, dueDate: "$$this.dueDate", label: "$$this.label" } },
              ] },
            ] },
          } } },
          in: "$$allocation.next",
        },
      }, null] },
    } },
    { $set: {
      state: { $switch: { branches: [
        { case: "$inactive", then: "inactive" },
        { case: { $eq: ["$outstanding", 0] }, then: "paid" },
        { case: { $eq: [{ $ifNull: ["$nextDue.dueDate", ""] }, ""] }, then: "unscheduled" },
        { case: { $lt: ["$nextDue.dueDate", today] }, then: "overdue" },
        { case: { $eq: ["$nextDue.dueDate", today] }, then: "today" },
      ], default: "upcoming" } },
      paymentStatus: { $switch: { branches: [
        { case: { $eq: ["$documentStatus", "Draft"] }, then: "Not issued" },
        { case: "$inactive", then: "Closed" },
        { case: { $eq: ["$outstanding", 0] }, then: "Paid" },
        { case: { $gt: [convert("$advancePaid", "double", 0), 0] }, then: "Part paid" },
      ], default: "Unpaid" } },
      dueOrder: { $cond: [{ $eq: [{ $ifNull: ["$nextDue.dueDate", ""] }, ""] }, UNSET_DUE_ORDER, "$nextDue.dueDate"] },
    } },
    { $set: {
      overdueFirst: { $cond: [{ $eq: ["$state", "overdue"] }, 1, 0] },
      daysOverdue: { $cond: [{ $eq: ["$state", "overdue"] }, { $dateDiff: {
        startDate: parseDay("$nextDue.dueDate"), endDate: new Date(today + "T00:00:00Z"), unit: "day",
      } }, 0] },
    } },
  ];
}

function makeFilters({ filter, search }) {
  const matches = {};
  if (filter === "draft") matches.documentStatus = "Draft";
  else if (filter === "outstanding") matches.outstanding = { $gt: 0 };
  else if (filter !== "all") matches.state = filter;
  if (search) {
    const fields = ["clientName", "invoiceNumber", "documentNumber", "title", "documentStatus", "paymentStatus"];
    const content = fields.flatMap((key, index) => [...(index ? [" "] : []), convert("$" + key, "string", "")]);
    matches.$expr = { $regexMatch: { input: { $concat: content }, regex: search.replace(/[.*+?^\$\{\}()|[\]\\]/g, "\\$&"), options: "i" } };
  }
  return Object.keys(matches).length ? [{ $match: matches }] : [];
}

const cursorTypes = {
  _id: value => typeof value === "string" && /^[a-f0-9]{24}$/.test(value),
  dueOrder: value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
  overdueFirst: value => value === 0 || value === 1,
  newest: value => Number.isSafeInteger(value) && Math.abs(value) <= 8640000000000000,
  outstanding: value => Number.isSafeInteger(value) && value >= 0,
};
function decodeCursor({ order, cursor, fingerprint }) {
  if (!cursor) return null;
  const keys = Object.keys(order);
  let decoded;
  try { decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); }
  catch { throw INVALID("This invoice page expired. Return to the first page."); }
  if (!Array.isArray(decoded) || decoded[0] !== fingerprint || decoded.length !== keys.length + 1 ||
      !keys.every((key, index) => cursorTypes[key](decoded[index + 1])))
    throw INVALID("This invoice page expired. Return to the first page.");
  return keys.map((key, index) => key === "_id" ? new Types.ObjectId(decoded[index + 1]) : decoded[index + 1]);
}

function afterCursor(order, values) {
  if (!values) return [];
  const keys = Object.keys(order);
  return [{ $match: { $or: keys.map((key, index) => Object.fromEntries([
    ...keys.slice(0, index).map((prev, previousIndex) => [prev, values[previousIndex]]),
    [key, { [order[key] === 1 ? "$gt" : "$lt"]: values[index] }],
  ])) } }];
}

async function listInvoiceRegister(Invoice, query, now = new Date()) {
  const options = registerOptions(query, now);
  const { filter, sort, search, order, today, fingerprint } = options;
  const values = decodeCursor(options);
  const stages = registerStages(today);
  const projection = { $project: { ...pageFields, cursorValues: Object.keys(order).map(key => "$" + key) } };
  let result;
  // Modern documents have a persisted invoice date. Read the page in index
  // order first and compute installment details only for that page. Legacy
  // dates fall back to createdAt, so they need the computed ordering below.
  if (sort === "newest" && filter === "all" && !search && !(await Invoice.exists({ invoiceDate: null }))) {
    const indexValues = values ? [new Date(values[0]), values[1]] : null;
    const [rows, overview] = await Promise.all([
      Invoice.aggregate([...afterCursor(INDEXED_NEWEST, indexValues), { $sort: INDEXED_NEWEST }, { $limit: PAGE_SIZE + 1 }, ...stages, projection]),
      Invoice.aggregate([...stages, exactOverview]),
    ]);
    result = { rows, overview, matched: [{ count: overview[0]?.total || 0 }] };
  } else {
    const filtered = makeFilters(options);
    [result] = await Invoice.aggregate([
      ...stages,
      { $facet: {
        overview: [exactOverview],
        matched: [...filtered, { $count: "count" }],
        rows: [...filtered, ...afterCursor(order, values), { $sort: order }, { $limit: PAGE_SIZE + 1 }, projection],
      } },
    ]);
  }
  const hasMore = result.rows.length > PAGE_SIZE;
  const rows = result.rows.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? Buffer.from(JSON.stringify([fingerprint, ...rows.at(-1).cursorValues])).toString("base64url") : null;
  return {
    total: result.overview[0]?.total || 0,
    overdue: result.overview[0]?.overdue || 0,
    matched: result.matched[0]?.count || 0,
    rows: rows.map(({ _id, cursorValues, ...row }) => row),
    nextCursor,
  };
}
module.exports = { listInvoiceRegister, PAGE_SIZE };
