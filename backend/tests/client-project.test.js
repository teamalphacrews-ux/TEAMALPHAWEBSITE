const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const adminUserId = "507f1f77bcf86cd79943fd01";
const clientUserId = "507f1f77bcf86cd79943fd02";
// Authorization uses the saved account role, independent of JWT role claims.
test.beforeEach((t) => {
  t.mock.method(User, "findById", (id) => ({
    select: async () => id === adminUserId ? { _id: id, role: "admin" }
      : id === clientUserId ? { _id: id, role: "client" } : null,
  }));
});
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const StudioConfig = require("../models/StudioConfig");
const ProjectMessage = require("../models/ProjectMessage");
const Notification = require("../models/Notification");
const {
  acceptedQuote,
  projectView,
  publicTask,
  messages,
  saveMessage,
  messageValues,
} = require("../services/clientProject");
const { taskValues } = require("../utils/productionTask");
const qid = "507f1f77bcf86cd799439022",
  iid = "507f1f77bcf86cd799439023",
  lid = "507f1f77bcf86cd799439024",
  pid = "507f1f77bcf86cd799439025";
const quote = {
  _id: qid,
  invoiceId: iid,
  lead: lid,
  studioProjectId: pid,
  totalPaise: 200000,
  clientName: "Sample client",
};
const invoice = {
  _id: iid,
  sourceQuotation: qid,
  documentNumber: "INV-TEST",
  documentStatus: "Draft",
  status: "Pending",
  total: 2000,
  advancePaid: 100,
  items: [],
  paymentSchedule: [{ amountPaise: 200000, dueDate: "2026-12-01" }],
  bankDetails: "private",
};
function dispatch(router, method, url, token, body = {}) {
  return new Promise((resolve, reject) =>
    router.handle(
      {
        method,
        url,
        body,
        query: {},
        headers: {},
        header: (name) => (name === "x-auth-token" ? token : null),
      },
      {
        statusCode: 200,
        set() {
          return this;
        },
        status(n) {
          this.statusCode = n;
          return this;
        },
        json(body) {
          resolve({ status: this.statusCode, body });
        },
      },
      (error) => (error ? reject(error) : resolve({ status: 404 })),
    ),
  );
}

test("client project requires an accepted quote and a valid active capability", async (t) => {
  let filter;
  t.mock.method(Quotation, "findOne", async (query) => {
    filter = query;
    return null;
  });
  await assert.rejects(() => acceptedQuote("invalid"), { status: 404 });
  assert.equal(filter, undefined);
  await assert.rejects(() => acceptedQuote("a".repeat(64)), { status: 404 });
  assert.equal(filter.status, "Accepted");
  assert.notEqual(filter.shareTokenHash, "a".repeat(64));
});
test("draft invoice exposes a preparation summary without schedule, bank details or private amounts", async (t) => {
  let filter;
  t.mock.method(Invoice, "findOne", async (value) => {
    filter = value;
    return { ...invoice, total: 9999 };
  });
  t.mock.method(Task, "find", () => {
    throw Error("Draft invoice cannot release production");
  });
  const result = await projectView(quote);
  assert.deepEqual(filter, { _id: iid, sourceQuotation: qid });
  assert.deepEqual(result.invoice, {
    state: "awaiting_approval",
    number: "INV-TEST",
    quotedTotal: 2000,
  });
  assert.equal(result.production.state, "awaiting_invoice");
  assert.equal(result.invoice.document, undefined);
});
test("mismatched or cancelled invoices do not release payments or production", async (t) => {
  t.mock.method(Invoice, "findOne", async () => null);
  assert.equal((await projectView(quote)).invoice.state, "preparing");
  t.mock.method(Invoice, "findOne", async () => ({
    ...invoice,
    documentStatus: "Sent",
    status: "Cancelled",
  }));
  assert.equal((await projectView(quote)).invoice.state, "cancelled");
});
test("issued invoice releases only published tasks for its canonical project and safe crew fields", async (t) => {
  t.mock.method(Invoice, "findOne", async () => ({
    ...invoice,
    documentStatus: "Sent",
  }));
  t.mock.method(StudioConfig, "findOne", async () => ({
    studioName: "Team Alpha",
  }));
  t.mock.method(Lead, "findById", async () => ({
    _id: lid,
    studioProjectId: pid,
  }));
  let filter;
  t.mock.method(Task, "find", (query) => {
    filter = query;
    return {
      populate() {
        return this;
      },
      sort: async () => [
        {
          _id: "visible",
          lead: lid,
          clientVisible: true,
          title: "PRIVATE edit notes",
          clientTitle: "Wedding photos",
          deliveryType: "Photos",
          productionStage: "Uploaded to Drive",
          deliveryUrl: "https://drive.google.com/example",
          clientUpdate: "Photos are available.",
          assignee: {
            _id: "private",
            name: "Sample editor",
            specialty: "EDITOR",
            email: "private@example.com",
            phone: "private",
          },
        },
        {
          _id: "hidden",
          lead: lid,
          clientVisible: false,
          title: "Internal expenses",
          productionStage: "Editing",
        },
        {
          _id: "other",
          lead: qid,
          clientVisible: true,
          clientTitle: "Other client",
          productionStage: "Editing",
        },
      ],
    };
  });
  const result = await projectView(quote);
  assert.deepEqual(filter, { lead: lid, clientVisible: true });
  assert.equal(result.invoice.state, "issued");
  assert.equal(result.production.deliveries.length, 1);
  const task = result.production.deliveries[0];
  assert.equal(task.title, "Wedding photos");
  assert.deepEqual(task.crew, { name: "Sample editor", role: "EDITOR" });
  assert.equal(task.url, "https://drive.google.com/example");
  assert.equal(task.lead, undefined);
  assert.equal(result.production.state, "delivered");
});
test("not-started production and unsafe or unfinished delivery links stay private", async (t) => {
  const base = {
    deliveryType: "Photos",
    productionStage: "Editing",
    deliveryUrl: "https://example.com/private-draft",
  };
  assert.equal(publicTask(base).url, "");
  assert.equal(
    publicTask({
      ...base,
      productionStage: "Ready",
      deliveryUrl: "javascript:alert(1)",
    }).url,
    "",
  );
  assert.equal(publicTask({ ...base, title: "INTERNAL NAME" }).title, "Photos");
  t.mock.method(Invoice, "findOne", async () => ({
    ...invoice,
    documentStatus: "Sent",
  }));
  t.mock.method(StudioConfig, "findOne", async () => ({}));
  t.mock.method(Lead, "findById", async () => ({
    _id: lid,
    studioProjectId: pid,
  }));
  t.mock.method(Task, "find", () => ({
    populate() {
      return this;
    },
    sort: async () => [
      {
        ...base,
        lead: lid,
        clientVisible: true,
        productionStage: "Not started",
      },
    ],
  }));
  const result = await projectView(quote);
  assert.equal(result.production.state, "not_started");
  assert.deepEqual(result.production.deliveries, []);
});
test("production task validation preserves privacy and synchronizes delivery and completion", () => {
  assert.equal(taskValues({ title: "Internal task" }).clientVisible, false);
  assert.throws(() => taskValues({ title: "Publish", clientVisible: true }), {
    status: 400,
  });
  for (const deliveryUrl of [
    "http://example.com",
    "javascript:alert(1)",
    "https://name:password@example.com",
  ])
    assert.throws(() => taskValues({ title: "Task", deliveryUrl }), {
      status: 400,
    });
  const task = taskValues({
    title: "Upload photos",
    lead: lid,
    clientVisible: true,
    productionStage: "Uploaded to Drive",
    assignee: pid,
  });
  assert.equal(task.status, "completed");
  assert.equal(
    taskValues({ status: "pending" }, task).productionStage,
    "In progress",
  );
});
test("support inputs are bounded plain text and ignore client-supplied authority", () => {
  assert.throws(
    () => messageValues({ text: "x".repeat(2001), requestId: "request_1" }),
    { status: 400 },
  );
  assert.throws(
    () => messageValues({ text: "Hello", requestId: "$operator" }),
    { status: 400 },
  );
  assert.deepEqual(
    messageValues({
      text: " Hello ",
      requestId: "request_1",
      author: "studio",
      quotation: "other",
    }),
    { text: "Hello", requestId: "request_1" },
  );
});
test("support retries save one message and never let a client choose its author or project", async (t) => {
  const store = [];
  let notifications = 0;
  t.mock.method(ProjectMessage, "findOne", async (query) =>
    store.find(
      (item) =>
        item.quotation === query.quotation &&
        item.author === query.author &&
        item.requestId === query.requestId,
    ),
  );
  t.mock.method(ProjectMessage, "countDocuments", async () => store.length);
  t.mock.method(ProjectMessage, "create", async (data) => {
    const item = {
      ...data,
      _id: iid,
      createdAt: new Date(),
      privateField: "hidden",
    };
    store.push(item);
    return item;
  });
  t.mock.method(Notification, "create", async () => {
    notifications++;
  });
  const body = {
    text: "Please check the album.",
    requestId: "retry_request_1",
    quotation: "other",
    author: "studio",
  };
  const first = await saveMessage(quote, "client", body),
    second = await saveMessage(quote, "client", body);
  assert.deepEqual(first, second);
  assert.equal(store.length, 1);
  assert.equal(notifications, 1);
  assert.equal(store[0].quotation, qid);
  assert.equal(store[0].author, "client");
  assert.equal(first.requestId, undefined);
  assert.equal(first.privateField, undefined);
});
test("support history is project-scoped, bounded and projected without private fields", async (t) => {
  let filter, bound;
  t.mock.method(ProjectMessage, "find", (query) => {
    filter = query;
    return {
      sort() {
        return this;
      },
      limit(n) {
        bound = n;
        return [
          {
            _id: iid,
            text: "Hello",
            author: "studio",
            quotation: qid,
            requestId: "private",
          },
        ];
      },
    };
  });
  const result = await messages(qid);
  assert.deepEqual(filter, { quotation: qid });
  assert.equal(bound, 100);
  assert.equal(result.messages[0].quotation, undefined);
  await assert.rejects(() => messages(qid, "bad-cursor"), { status: 400 });
});
test("admin support rejects missing and client credentials before querying storage", async (t) => {
  const router = require("../routes/projectSupportRoutes");
  process.env.JWT_SECRET = "project-support-test";
  t.mock.method(Quotation, "find", () => {
    throw Error("Must not query");
  });
  assert.equal((await dispatch(router, "GET", "/")).status, 401);
  const token = jwt.sign(
    { user: { id: clientUserId, role: "client" } },
    process.env.JWT_SECRET,
  );
  assert.equal((await dispatch(router, "GET", "/", token)).status, 403);
});
test("only studio approval releases a validated current invoice, and concurrent changes require reload", async (t) => {
  const router = require("../routes/invoiceRoutes");
  process.env.JWT_SECRET = "invoice-project-approval-test";
  const token = jwt.sign(
    { user: { id: adminUserId, role: "admin" } },
    process.env.JWT_SECRET,
  );
  const stored = {
    ...invoice,
    clientName: "Sample client",
    invoiceDate: "2026-10-20",
    dueDate: "2026-11-20",
    items: [{ title: "Coverage", quantity: 1, unitPricePaise: 200000 }],
    updatedAt: new Date(),
    issuer: { name: "Team Alpha", logoUrl: "/team-alpha-logo.png" },
  };
  t.mock.method(Invoice, "findById", async () => ({
    ...stored,
    toObject: () => stored,
  }));
  let filter;
  t.mock.method(Invoice, "findOneAndUpdate", async (query, update) => {
    filter = query;
    return { ...stored, ...update.$set };
  });
  const issued = await dispatch(router, "POST", "/" + iid + "/approve", token);
  assert.equal(issued.status, 200);
  assert.equal(issued.body.documentStatus, "Sent");
  assert.equal(issued.body.total, 2000);
  assert.ok(issued.body.approvedAt);
  assert.equal(filter.updatedAt, stored.updatedAt);
  assert.deepEqual(filter.status, { $ne: "Cancelled" });
  t.mock.method(Invoice, "findOneAndUpdate", async () => null);
  assert.equal(
    (await dispatch(router, "POST", "/" + iid + "/approve", token)).status,
    409,
  );
  t.mock.method(Invoice, "findById", async () => ({
    ...stored,
    status: "Cancelled",
  }));
  assert.equal(
    (await dispatch(router, "POST", "/" + iid + "/approve", token)).status,
    409,
  );
});

test("reading support marks only delivered client messages and preserves unseen unread messages", async (t) => {
  const router = require("../routes/projectSupportRoutes");
  process.env.JWT_SECRET = "support-read-snapshot-test";
  const token = jwt.sign(
    { user: { id: adminUserId, role: "admin" } },
    process.env.JWT_SECRET,
  );
  t.mock.method(Quotation, "findById", () => ({
    select: async () => ({ ...quote, status: "Accepted" }),
  }));
  t.mock.method(ProjectMessage, "find", () => ({
    sort() {
      return this;
    },
    limit: async () => [
      { _id: iid, author: "client", text: "Seen" },
      { _id: pid, author: "studio", text: "Reply" },
    ],
  }));
  let filter;
  t.mock.method(ProjectMessage, "updateMany", async (value) => {
    filter = value;
  });
  t.mock.method(ProjectMessage, "countDocuments", async () => 2);
  const result = await dispatch(router, "GET", "/" + qid + "/messages", token);
  assert.equal(result.status, 200);
  assert.equal(result.body.clientUnread, 2);
  assert.deepEqual(filter._id, { $in: [iid] });
  assert.equal(filter.quotation, qid);
});

test("support inbox includes older active clients and summarizes messages without history truncation", async (t) => {
  const router = require("../routes/projectSupportRoutes");
  process.env.JWT_SECRET = "support-inbox-history-test";
  const token = jwt.sign(
    { user: { id: adminUserId, role: "admin" } },
    process.env.JWT_SECRET,
  );
  const quotes = Array.from({ length: 201 }, (_, index) => ({
    _id: String(index),
    clientName: "Client " + index,
  }));
  t.mock.method(Quotation, "find", () => ({
    sort() {
      return this;
    },
    select: async () => quotes,
  }));
  let pipeline;
  t.mock.method(ProjectMessage, "aggregate", async (value) => {
    pipeline = value;
    return [
      {
        _id: "200",
        latestMessage: {
          _id: iid,
          text: "New request from an older client",
          author: "client",
          createdAt: new Date(),
        },
        clientUnread: 1,
      },
    ];
  });
  const result = await dispatch(router, "GET", "/", token);
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 201);
  assert.equal(result.body[0]._id, "200");
  assert.equal(result.body[0].clientUnread, 1);
  assert.equal(pipeline[0].$match.quotation.$in.length, 201);
  assert.ok(pipeline.some((step) => step.$group));
  assert.ok(!pipeline.some((step) => step.$limit));
});
