const mongoose = require("mongoose");
const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};
const text = (value, name, max, required = false) => {
  if (value != null && typeof value !== "string") fail(`${name} must be text`);
  const clean = (value || "").trim();
  if ((required && !clean) || clean.length > max)
    fail(`${name} is required and must be at most ${max} characters`);
  return clean;
};
const identifier = (value, name) => {
  if (
    typeof value !== "string" ||
    !/^[a-f\d]{24}$/i.test(value) ||
    !mongoose.isValidObjectId(value)
  )
    fail(`${name} is invalid`);
  return value;
};
function contact(body, partial = false) {
  const result = {};
  const fields = {
    firstName: 100,
    lastName: 100,
    company: 200,
    phone: 60,
    addressLine1: 250,
    addressLine2: 250,
    city: 100,
    state: 100,
    postalCode: 30,
    country: 100,
    note: 5000,
  };
  for (const [key, max] of Object.entries(fields))
    if (!partial || Object.hasOwn(body, key))
      result[key] = text(body[key], key, max, key === "firstName");
  if (!partial || Object.hasOwn(body, "email")) {
    result.email = text(body.email, "Email", 254, true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
      fail("Enter a valid email address");
  }
  if (!partial || Object.hasOwn(body, "contactType")) {
    result.contactType = body.contactType || "Client";
    if (!["Client", "Lead", "Other"].includes(result.contactType))
      fail("Choose a valid contact type");
  }
  if (Object.hasOwn(body, "archived")) {
    if (typeof body.archived !== "boolean")
      fail("Archived must be true or false");
    result.archived = body.archived;
  }
  return result;
}
function project(body, partial = false) {
  const result = {};
  if (!partial || Object.hasOwn(body, "contactId"))
    result.contactId = identifier(body.contactId, "Client");
  for (const [key, max] of Object.entries({
    name: 200,
    type: 100,
    location: 500,
    description: 5000,
  }))
    if (!partial || Object.hasOwn(body, key))
      result[key] = text(
        body[key] || (key === "type" ? "Wedding" : ""),
        key,
        max,
        key === "name",
      );
  if (!partial || Object.hasOwn(body, "status")) {
    result.status = body.status || "Inquiry";
    if (!["Inquiry", "Booked", "Completed", "Archived"].includes(result.status))
      fail("Choose a valid project status");
  }
  for (const key of ["startDate", "endDate"])
    if (!partial || Object.hasOwn(body, key)) {
      if (!body[key]) result[key] = null;
      else {
        const value = text(body[key], key, 10);
        const date = new Date(value + "T00:00:00.000Z");
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value
        )
          fail("Choose a valid project date");
        result[key] = date;
      }
    }
  if (result.startDate && result.endDate && result.endDate < result.startDate)
    fail("Project end date must follow its start date");
  if (!partial || Object.hasOwn(body, "additionalClients")) {
    if (
      body.additionalClients != null &&
      !Array.isArray(body.additionalClients)
    )
      fail("Additional clients must be a list");
    if ((body.additionalClients || []).length > 30)
      fail("A project can have at most 30 additional clients");
    result.additionalClients = [
      ...new Set(
        (body.additionalClients || []).map((id) =>
          identifier(id, "Additional client"),
        ),
      ),
    ];
  }
  return result;
}
function note(body) {
  return { body: text(body.body, "Note", 5000, true), createdAt: new Date() };
}
module.exports = { contact, project, note, identifier };
