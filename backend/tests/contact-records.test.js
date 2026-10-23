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
const records = require("../utils/contactRecords");
const Contact = require("../models/StudioContact");
const Project = require("../models/StudioProject");
const Document = require("../models/ContactDocument");
const router = require("../routes/contactRoutes");
const contactId = "507f1f77bcf86cd799439011", projectId = "507f1f77bcf86cd799439012";
process.env.JWT_SECRET = "test-only-contact-workflow-secret";
function dispatch(method, url, body, role = "admin") {
  const token = role ? jwt.sign({ user: { id: role === "admin" ? adminUserId : clientUserId, role } }, process.env.JWT_SECRET) : "";
  return new Promise((resolve, reject) => router.handle({ method, url, body, headers: token ? { authorization: "Bearer " + token } : {}, header: (name) => name.toLowerCase() === "authorization" && token ? "Bearer " + token : undefined }, { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, body }); } }, (err) => err ? reject(err) : resolve({ status: 404 })));
}
test("contact records are independent of login accounts and strictly whitelist identity fields", () => {
  const value = records.contact({ firstName: " Maya ", email: "MAYA@example.com", company: "Studio", contactType: "Lead", password: "must-not-store", role: "admin", cloudLink: "https://example.com" });
  assert.equal(value.firstName, "Maya"); assert.equal(value.email, "maya@example.com"); assert.equal(value.lastName, "");
  assert.equal(value.password, undefined); assert.equal(value.role, undefined); assert.equal(value.cloudLink, undefined);
  assert.deepEqual(records.contact({ note: "Internal note" }, true), { note: "Internal note" });
  for (const patch of [{ firstName: "" }, { email: "bad" }, { contactType: "Admin" }, { phone: {} }, { archived: "yes" }]) assert.throws(() => records.contact({ firstName: "Maya", email: "maya@example.com", ...patch }), { status: 400 });
});
test("project validation rejects impossible ranges and forged identifiers", () => {
  const valid = { contactId, name: "Maya's wedding", startDate: "2028-02-29", endDate: "2028-03-01", additionalClients: [projectId, projectId], notes: [{ body: "injected" }], owner: "ignored" };
  const value = records.project(valid); assert.equal(value.startDate.toISOString(), "2028-02-29T00:00:00.000Z"); assert.deepEqual(value.additionalClients, [projectId]); assert.equal(value.notes, undefined); assert.equal(value.owner, undefined);
  for (const patch of [{ contactId: "bad" }, { startDate: "2027-02-29" }, { endDate: "2028-02-28" }, { additionalClients: "bad" }, { status: "Paid" }]) assert.throws(() => records.project({ ...valid, ...patch }), { status: 400 });
  assert.deepEqual(records.project({ status: "Booked" }, true), { status: "Booked" });
});
test("contact and project endpoints reject unauthenticated and client requests before storage", async () => {
  for (const [method, path] of [["GET", "/contacts"], ["POST", "/contacts"], ["GET", "/contacts/" + contactId], ["PATCH", "/contacts/" + contactId], ["GET", "/studio-projects"], ["POST", "/studio-projects"], ["GET", "/studio-projects/" + projectId], ["PATCH", "/studio-projects/" + projectId], ["POST", "/studio-projects/" + projectId + "/notes"], ["POST", "/contact-documents"], ["PATCH", "/contact-documents/" + projectId]]) {
    assert.equal((await dispatch(method, path, {}, "client")).status, 403, method + " " + path);
    assert.equal((await dispatch(method, path, {}, null)).status, 401, method + " " + path);
  }
});
test("contact creation persists only validated fields and does not create a user", async (t) => {
  let captured;
  t.mock.method(Contact, "create", async (value) => { captured = value; return { _id: contactId, ...value }; });
  const response = await dispatch("POST", "/contacts", { firstName: "Maya", email: "MAYA@example.com", password: "injected", role: "admin" });
  assert.equal(response.status, 201); assert.equal(captured.password, undefined); assert.equal(captured.role, undefined); assert.equal(captured.email, "maya@example.com");
});
test("partial project date edits are checked against the persisted opposite endpoint", async (t) => {
  t.mock.method(Project, "findById", async () => ({ contactId, startDate: new Date("2028-03-01"), endDate: new Date("2028-03-02") }));
  t.mock.method(Project, "findByIdAndUpdate", async () => { assert.fail("Invalid range must never reach persistence"); });
  assert.equal((await dispatch("PATCH", "/studio-projects/" + projectId, { endDate: "2028-02-29" })).status, 400);
});
test("generic drafts cannot attach to another contact's project or claim delivery", async (t) => {
  t.mock.method(Contact, "findOne", async () => ({ _id: contactId }));
  t.mock.method(Project, "exists", async () => null);
  t.mock.method(Document, "create", async () => { assert.fail("Invalid relationship must never reach persistence"); });
  const body = { contactId, studioProjectId: projectId, type: "Contract", title: "Wedding agreement", content: "Terms", status: "Sent" };
  assert.equal((await dispatch("POST", "/contact-documents", body)).status, 400);
  t.mock.method(Project, "exists", async () => ({ _id: projectId }));
  let saved; t.mock.method(Document, "create", async (value) => { saved = value; return value; });
  assert.equal((await dispatch("POST", "/contact-documents", body)).status, 201); assert.equal(saved.status, "Draft");
});
test("project notes are bounded, timestamped, and cannot replace existing notes", async (t) => {
  let captured;
  t.mock.method(Project, "findByIdAndUpdate", async (_id, update) => { captured = update; return { _id: projectId }; });
  assert.equal((await dispatch("POST", "/studio-projects/" + projectId + "/notes", { body: " Site visit complete ", createdAt: "2000-01-01" })).status, 201);
  assert.equal(captured.$push.notes.$each[0].body, "Site visit complete"); assert.equal(captured.$push.notes.$slice, -200); assert.notEqual(captured.$push.notes.$each[0].createdAt.getFullYear(), 2000);
  assert.equal((await dispatch("POST", "/studio-projects/" + projectId + "/notes", { body: "" })).status, 400);
});
