const test = require("node:test");
test.beforeEach(require('./sessionFixture'));
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
const validate = require("../utils/studioRecords");
const { expired, publicQuote } = require("../utils/quoteLifecycle");
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const StudioConfig = require("../models/StudioConfig");
const QuoteDelivery = require("../models/QuoteDelivery");
const StudioContact = require("../models/StudioContact");
const StudioProject = require("../models/StudioProject");
const Notification = require("../models/Notification");
const workflow = require("../services/quoteWorkflow");
const mailer = require("../services/studioMailer");
const routes = require("../routes/quoteWorkflowRoutes");
const publicRoutes = require("../routes/publicQuoteRoutes");
const id = "507f1f77bcf86cd799439022";
const token = "c".repeat(64);
const body = { clientName: "Sample", email: "sample@example.com", title: "Wedding", items: [{ title: "Wedding", description: "Photography", quantity: 2, unitPricePaise: 100001 }], validUntil: "2099-12-31" };
const quote = { _id: id, ...validate.quotation(body), revision: 2, status: "Sent" };
process.env.JWT_SECRET = "quote-workflow-test-only-secret";
function dispatch(router, method, url, body = {}, role = "admin", app) {
  const signed = jwt.sign({ user: { id: role === "admin" ? adminUserId : clientUserId, role } }, process.env.JWT_SECRET);
  return new Promise((resolve,reject) => router.handle({ method, url, body, app, headers: { authorization: "Bearer " + signed }, header: name => name.toLowerCase() === "authorization" ? "Bearer " + signed : undefined }, { statusCode: 200, set() { return this; }, status(n) { this.statusCode = n; return this; }, json(data) { resolve({ status: this.statusCode, body: data }); } }, error => error ? reject(error) : resolve({ status:404 })));
}
test("quotation project links require the selected contact to belong to the project", async t => {
  t.mock.method(StudioContact,"exists",async () => true);
  t.mock.method(StudioProject,"exists",async filter => !filter.$or);
  await assert.rejects(routes.references({contactId:id,studioProjectId:id}), {status:400});
});
test("percent discounts round paise once and preserve fixed-discount compatibility", () => {
  const p = validate.quotation({ ...body, discountType: "percent", discountValue: 12.5, discountPaise: 1, totalPaise: 1 });
  assert.equal(p.discountPaise, 25000);
  assert.equal(p.totalPaise, 175002);
  assert.equal(validate.quotation({ ...body, discountType: "amount", discountValue: 123.45 }).discountPaise, 12345);
  assert.equal(validate.quotation({ ...body, discountPaise: 12345 }).discountValue, 123.45);
  for (const values of [{ discountType: "percent", discountValue: 100.01 }, { discountValue: -1 }, { discountValue: 1.001 }, { discountType: "arbitrary" }]) assert.throws(() => validate.quotation({ ...body, ...values }), { status:400 });
});
test("quotation metadata validates booleans, references, numbering, reminders and safe design", () => {
  const values = validate.quotation({ ...body, expiryEnabled: false, autoCreateInvoice: false, reminderDays: [7,3,7], documentNumber: "TA/2026-001", design: { coverImage: "/assets/studio-wedding.webp", colorTheme: "#123abc", fontTheme: "classic" }, role: "admin" });
  assert.deepEqual(values.reminderDays, [3,7]);
  assert.equal(values.expiryEnabled,false);
  assert.equal(values.role,undefined);
  for (const patch of [{ autoCreateInvoice: "true" }, { reminderDays: [0] }, { documentNumber: "bad\nnumber" }, { contactId: "x" }, { design: { coverImage: "javascript:alert(1)" } }, { design: { coverImage: "https://user:pass@example.com/image" } }, { design: { colorTheme: "red" } }]) assert.throws(() => validate.quotation({ ...body, ...patch }), { status:400 });
});
test("expiry can be disabled without exposing private client identifiers", () => {
  const q = { ...quote, validUntil: null, expiryEnabled: false, contactId: "private", studioProjectId: "private", notes: "Public notes" };
  assert.equal(expired(q),false);
  const view = publicQuote(q,{});
  assert.equal(view.expiresAt,null);
  assert.equal(view.expiryEnabled,false);
  assert.equal(view.contactId,undefined);
  assert.equal(view.studioProjectId,undefined);
});
test("templates retain reusable settings and exclude all client/project identity", () => {
  const value = routes.templateValues({ ...body, name:"Wedding", validityDays:30, contactId:id, studioProjectId:id, discountType:"percent", discountValue:5, notes:"Notes", autoCreateInvoice:false, expiryEnabled:false, remindersEnabled:true, reminderDays:[3] });
  assert.equal(value.discountType,"percent");
  assert.equal(value.autoCreateInvoice,false);
  assert.equal(value.expiryEnabled,false);
  assert.deepEqual(value.reminderDays,[3]);
  for (const key of ["contactId","studioProjectId","email","clientName","lead","documentNumber"]) assert.equal(value[key],undefined);
});
test("all quotation workflow routes enforce admin authorization", async () => {
  for (const [method,path] of [["GET","preview"],["GET","email-history"],["POST","email"],["POST","share"],["POST","schedule"],["DELETE","schedule"],["POST","duplicate"],["POST","cancel"],["POST","archive"],["PATCH","project"],["PATCH","number"],["PUT","settings"]]) assert.equal((await dispatch(routes,method,`/quotations/${id}/${path}`,{},"client")).status,403);
});
test("admin preview excludes tokens and cannot accept a quotation", async t => {
  t.mock.method(Quotation,"findById", async () => ({ ...quote, shareToken:token }));
  t.mock.method(StudioConfig,"findOne", async () => ({}));
  const result = await dispatch(routes,"GET",`/quotations/${id}/preview`);
  assert.equal(result.status,200);
  assert.equal(result.body.preview,true);
  assert.equal(result.body.shareToken,undefined);
});
test("concurrent Share requests converge on a single client token", async t => {
  let stored = { ...quote, status:"Draft" }, claims = 0;
  t.mock.method(Quotation,"findById", () => ({ select: async () => ({ ...stored }) }));
  t.mock.method(Quotation,"findOneAndUpdate", async (filter,update) => {
    assert.deepEqual(filter.shareTokenHash,{$exists:false});
    if (stored.status !== "Draft") return null;
    claims++;
    stored = { ...stored, ...update.$set };
    return stored;
  });
  const results = await Promise.all([workflow.shareQuote(id),workflow.shareQuote(id)]);
  assert.equal(results[0].token,results[1].token);
  assert.equal(claims,1);
  assert.equal(workflow.safeQuote(stored).shareToken,undefined);
});
test("manual sharing works without email and returns the canonical client link", async t => {
  const previous = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://teamalpha.example.test';
  t.after(() => { if (previous === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previous; });
  let stored = { ...quote, status: 'Draft' };
  t.mock.method(mailer, 'mailerReady', () => false);
  t.mock.method(mailer, 'sendStudioMail', () => { throw Error('Manual sharing must not send email'); });
  t.mock.method(QuoteDelivery, 'findOneAndUpdate', () => { throw Error('Manual sharing must not queue email'); });
  t.mock.method(Quotation, 'findById', () => ({ select: async () => ({ ...stored }) }));
  t.mock.method(Quotation, 'findOneAndUpdate', async (_filter, update) => (stored = { ...stored, ...update.$set }));
  const result = await dispatch(routes, 'POST', `/quotations/${id}/share`);
  assert.equal(result.status, 200);
  assert.equal(result.body.quote.status, 'Sent');
  assert.equal(result.body.url, `https://teamalpha.example.test/quote/${result.body.token}`);
  assert.equal(result.body.quote.shareToken, undefined);
  assert.equal(result.body.quote.shareTokenHash, undefined);
  assert.equal(stored.shareTokenHash, require('../utils/quoteLifecycle').tokenHash(result.body.token));
});
test("an invalid public website configuration cannot mark a quote as shared", async t => {
  const previous = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://user:password@example.test';
  t.after(() => { if (previous === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previous; });
  t.mock.method(workflow, 'shareQuote', () => { throw Error('Do not mutate a quotation before validating its public origin'); });
  const result = await dispatch(routes, 'POST', `/quotations/${id}/share`);
  assert.equal(result.status, 503);
  assert.equal(result.body.token, undefined);
});
test("email validation rejects header injection; missing configuration does not create a sent record", async t => {
  assert.throws(() => workflow.emailValues({subject:"Hello\r\nBcc:someone@example.com"}),{status:400});
  t.mock.method(mailer,"mailerReady", () => false);
  t.mock.method(QuoteDelivery,"findOneAndUpdate", () => { throw Error("Must not queue"); });
  await assert.rejects(workflow.queueEmail(quote,{}),{status:503});
  assert.equal(mailer.escapeHtml('<script>"x"</script>'),"&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
test("delivery cancels stale quotation revisions before SMTP is called", async t => {
  const job = { _id:id, quotation:id, revision:1, kind:"email" };
  t.mock.method(QuoteDelivery,"findOneAndUpdate", async () => job);
  t.mock.method(Quotation,"findById", () => ({ select: async () => quote }));
  t.mock.method(QuoteDelivery,"findByIdAndUpdate", async (id,update) => ({...job,...update.$set}));
  t.mock.method(mailer,"sendStudioMail", () => { throw Error("Must not send"); });
  assert.equal((await workflow.processDelivery(id)).status,"cancelled");
});
test("scheduled email is rejected after expiry and uses an idempotent request key", async t => {
  t.mock.method(mailer,"mailerReady", () => true);
  t.mock.method(mailer,"frontendOrigin", () => "https://studio.example.com");
  let saved;
  t.mock.method(QuoteDelivery,"findOneAndUpdate", async (filter,update) => { saved={filter,update};return update.$setOnInsert; });
  const scheduledFor = new Date(Date.now()+3600000).toISOString();
  await workflow.queueEmail(quote,{subject:"Quotation",message:"Review",idempotencyKey:"request_123"},scheduledFor);
  assert.equal(saved.filter.key,`scheduled:${id}:2:request_123`);
  assert.equal(saved.update.$setOnInsert.status,"queued");
  assert.equal(saved.update.$setOnInsert.recipient,quote.email);
  await assert.rejects(workflow.queueEmail({...quote,validUntil:new Date()}, {}, new Date(Date.now()+3*86400000).toISOString()),{status:400});
});
test("SMTP acknowledgement creates sent history; uncertain errors are not automatically retried", async t => {
  const job = { _id:id, quotation:id, revision:2, kind:"confirmation",subject:"Confirmed",message:"Thanks" };
  let stored={...job,status:"queued"}, calls=0, uncertain=false;
  t.mock.method(QuoteDelivery,"findOneAndUpdate", async () => stored.status === "queued" ? (stored={...stored,status:"processing"}) : null);
  t.mock.method(QuoteDelivery,"findById", async () => stored);
  t.mock.method(QuoteDelivery,"findByIdAndUpdate", async (id,update) => (stored={...stored,...update.$set}));
  t.mock.method(Quotation,"findById", () => ({ select: async () => ({...quote,status:"Accepted",shareToken:token}) }));
  t.mock.method(Quotation,"findByIdAndUpdate", async () => ({}));
  t.mock.method(StudioConfig,"findOne", async () => ({}));
  t.mock.method(mailer,"frontendOrigin", () => "https://studio.example.com");
  t.mock.method(mailer,"sendStudioMail", async () => { calls++;if(uncertain)throw Error("timeout");return {messageId:"mail-1"}; });
  assert.equal((await workflow.processDelivery(id)).status,"sent");
  assert.equal(stored.messageId,"mail-1");
  stored={...job,status:"queued"};uncertain=true;
  assert.equal((await workflow.processDelivery(id)).status,"unknown");
  assert.equal((await workflow.processDelivery(id)).status,"unknown");
  assert.equal(calls,2);
});
test("client acceptance supports no expiry and automatic invoice disabled", async t => {
  let stored = { ...quote, expiryEnabled:false, validUntil:null, autoCreateInvoice:false };
  t.mock.method(Quotation,"findOne", async () => stored);
  t.mock.method(Quotation,"findOneAndUpdate", async (filter,update) => {
    assert.equal(filter.validUntil,undefined);
    assert.equal(update.$set.invoiceId,undefined);
    stored = {...stored,...update.$set};
    return stored;
  });
  t.mock.method(StudioConfig,"findOne", async () => ({}));
  t.mock.method(Invoice,"findOneAndUpdate", () => { throw Error("Must not create invoice"); });
  const result = await dispatch(publicRoutes,"POST",`/${token}/accept`,{acceptedBy:"Client",consent:true,revision:2});
  assert.equal(result.status,200);
  assert.equal(result.body.status,"Accepted");
  assert.equal(result.body.invoiceReady,false);
  assert.equal(result.body.autoCreateInvoice,false);
});
test("acceptance retries record one studio notification and preserve a persistent marker", async t => {
  assert.ok(Quotation.schema.path("acceptedNotifiedAt"));
  let stored={...quote,status:"Accepted",autoCreateInvoice:false}, notifications=0;
  t.mock.method(Quotation,"findOne",async () => stored);
  t.mock.method(Quotation,"findOneAndUpdate",async (filter,update) => {
    if (filter.acceptedNotifiedAt && stored.acceptedNotifiedAt) return null;
    stored={...stored,...update.$set};return stored;
  });
  t.mock.method(StudioConfig,"findOne",async () => ({}));
  t.mock.method(Notification,"create",async () => {notifications++;return {};});
  t.mock.method(mailer,"mailerReady",() => false);
  const data={acceptedBy:"Client",consent:true,revision:2};
  for(let i=0;i<2;i++)assert.equal((await dispatch(publicRoutes,"POST",`/${token}/accept`,data,"admin",{})).status,200);
  assert.equal(notifications,1);
  assert.ok(stored.acceptedNotifiedAt instanceof Date);
});
test("confirmation retries report the persisted delivery state honestly", async t => {
  t.mock.method(mailer,"mailerReady",() => true);
  t.mock.method(mailer,"frontendOrigin",() => "https://studio.example.com");
  t.mock.method(QuoteDelivery,"findOneAndUpdate",async () => ({status:"sent"}));
  assert.equal(await workflow.queueConfirmation(quote),"sent");
});
test("reminder recovery schedules only the newest missed reminder", async t => {
  const keys=[];
  t.mock.method(mailer,"mailerReady",() => true);
  t.mock.method(Quotation,"find",() => ({limit:async () => [{...quote,remindersEnabled:true,reminderDays:[3,7,14,21,30],sharedAt:new Date(Date.now()-15*86400000)}]}));
  t.mock.method(QuoteDelivery,"updateMany",async () => ({}));
  t.mock.method(QuoteDelivery,"updateOne",async filter => {keys.push(filter.key);return {};});
  t.mock.method(QuoteDelivery,"find",() => ({sort:() => ({limit:async () => []})}));
  await workflow.runQuoteDeliveryJobs();
  assert.deepEqual(keys,[`reminder:${id}:2:14`]);
});
