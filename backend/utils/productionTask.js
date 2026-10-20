const deliveryTypes = [
  "Photos",
  "Album",
  "Traditional video",
  "Cinematic video",
  "Other",
];
const productionStages = [
  "Not started",
  "In progress",
  "Editing",
  "In review",
  "Awaiting your selection",
  "Ready",
  "Uploaded to Drive",
  "Delivered",
];
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
const text = (value, length) =>
  typeof value === "string" ? value.trim().slice(0, length) : "";
function deliveryUrl(value) {
  if (!value) return "";
  if (typeof value !== "string" || value.length > 2000)
    fail("Enter a valid delivery link");
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* invalid */
  }
  fail("Delivery links must use HTTPS and must not contain login credentials");
}
function taskValues(body, existing = {}) {
  const input = { ...existing, ...body };
  const title = text(input.title, 200);
  if (!title) fail("Give the task a title");
  let status = input.status || "pending";
  let stage = input.productionStage || "Not started";
  if (!["pending", "completed"].includes(status)) fail("Invalid task status");
  if (!productionStages.includes(stage)) fail("Invalid production stage");
  if (Object.hasOwn(body, "productionStage"))
    status = ["Delivered", "Uploaded to Drive"].includes(stage)
      ? "completed"
      : "pending";
  else if (Object.hasOwn(body, "status") && input.clientVisible)
    stage =
      status === "completed"
        ? "Delivered"
        : ["Delivered", "Uploaded to Drive"].includes(stage)
          ? "In progress"
          : stage;
  if (!deliveryTypes.includes(input.deliveryType || "Other"))
    fail("Invalid deliverable type");
  if (input.clientVisible != null && typeof input.clientVisible !== "boolean")
    fail("Choose whether the client can see this task");
  const result = {
    title,
    status,
    productionStage: stage,
    deliveryType: input.deliveryType || "Other",
    clientVisible: input.clientVisible === true,
    clientTitle: text(input.clientTitle, 200),
    clientUpdate: text(input.clientUpdate, 2000),
    deliveryUrl: deliveryUrl(input.deliveryUrl),
    dueDate: null,
    lead: input.lead?._id || input.lead || null,
    assignee: input.assignee?._id || input.assignee || null,
  };
  for (const key of ["lead", "assignee"])
    if (result[key] && !/^[a-f\d]{24}$/i.test(String(result[key])))
      fail("Invalid project or crew member");
  if (result.clientVisible && !result.lead)
    fail("Link a project before publishing a client update");
  if (input.dueDate) {
    if (!Number.isFinite(Date.parse(input.dueDate)))
      fail("Enter a valid due date");
    result.dueDate = new Date(input.dueDate);
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) &&
      result.dueDate.toISOString().slice(0, 10) !== input.dueDate
    )
      fail("Enter a valid due date");
  }
  return result;
}
async function validateTaskLinks(values) {
  for (const [key, model] of [
    ["lead", "Lead"],
    ["assignee", "Photographer"],
  ])
    if (
      values[key] &&
      !(await require("../models/" + model).exists({ _id: values[key] }))
    )
      fail("The selected project or crew member no longer exists");
}
module.exports = {
  taskValues,
  validateTaskLinks,
  deliveryUrl,
  deliveryTypes,
  productionStages,
};
