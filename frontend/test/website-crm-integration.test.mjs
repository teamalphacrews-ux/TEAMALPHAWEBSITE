import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import { createWebsiteRouter } from "../website-server.mjs";
const require = createRequire(import.meta.url);
const {
  createEnquiryWebhookHandler,
} = require("../../backend/utils/enquiryWebhook.js");

test("website enquiries reach the existing CRM handler once across gateway restarts", async () => {
  const records = new Map();
  const secret = "disposable-test-webhook-secret-never-used-in-production";
  const Lead = {
    async init() {},
    collection: { async createIndex() {} },
    async findOneAndUpdate(filter, update) {
      const existing = records.get(filter.webhookEventId);
      if (existing)
        return { value: existing, lastErrorObject: { updatedExisting: true } };
      const lead = { _id: "sample-lead-1", ...update.$setOnInsert };
      records.set(filter.webhookEventId, lead);
      return { value: lead, lastErrorObject: { updatedExisting: false } };
    },
  };
  const backend = createEnquiryWebhookHandler({
    Lead,
    getSecret: () => secret,
  });
  let upstreamCalls = 0;
  const fetchImpl = async (_url, options) => {
    upstreamCalls++;
    const headers = new Headers(options.headers);
    let code = 200;
    let body;
    await backend(
      { body: JSON.parse(options.body), header: (name) => headers.get(name) },
      {
        status(value) {
          code = value;
          return this;
        },
        json(value) {
          body = value;
          return this;
        },
      },
    );
    return new Response(JSON.stringify(body), {
      status: code,
      headers: { "Content-Type": "application/json" },
    });
  };
  const options = {
    env: {
      WEBSITE_ENQUIRY_WEBHOOK_URL:
        "https://crm.example.test/api/webhooks/enquiries",
      WEBSITE_ENQUIRY_WEBHOOK_SECRET: secret,
    },
    fetchImpl,
  };
  const app = express();
  // Two fresh gateways model a frontend restart; durable idempotency stays in CRM.
  app.use("/first", createWebsiteRouter(options));
  app.use("/restarted", createWebsiteRouter(options));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  const key = "ta_disposable_crm_integration_test";
  const form = {
    name: "Preview couple",
    email: "PREVIEW@example.test",
    phone: "+919800000001",
    eventType: "Wedding",
    eventDate: "2099-02-14",
    eventCity: "Bengaluru",
    venue: "Preview venue",
    coverage: ["Wedding photography"],
    deliverables: ["Fine-art album"],
    budget: "₹1,50,000 – ₹2,50,000",
    details: "A disposable integration test.",
    source: "/stories/wedding-editorial",
    startedAt: Date.now() - 3000,
    website: "",
    requestId: key,
  };
  try {
    for (const [path, status, duplicate] of [
      ["first", 201, false],
      ["restarted", 200, true],
    ]) {
      const response = await fetch(origin + "/" + path + "/enquiries", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(form),
      });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { success: true, duplicate });
    }
    assert.equal(upstreamCalls, 2);
    assert.equal(records.size, 1);
    const [lead] = records.values();
    assert.equal(lead.name, "Preview couple");
    assert.equal(lead.email, "preview@example.test");
    assert.equal(lead.status, "New");
    assert.equal(lead.phone, form.phone);
    assert.equal(lead.eventDate, form.eventDate);
    assert.match(lead.eventLocation, /Bengaluru/);
    for (const expected of [
      form.venue,
      form.coverage[0],
      form.deliverables[0],
      form.budget,
      form.source,
    ])
      assert.ok(lead.notes.includes(expected));
    assert.ok(lead.createdAt instanceof Date);
    assert.ok(lead.updatedAt instanceof Date);
    assert.equal(lead.createAccount, undefined);
    assert.equal(lead.role, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
