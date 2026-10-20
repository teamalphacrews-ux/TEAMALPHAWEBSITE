import test from "node:test";
import assert from "node:assert/strict";
import { invoiceForLead, invoiceDestination } from "../src/admin/components/operations/invoiceNavigation.js";
import { invoiceRows } from "../src/utils/invoiceDocument.js";

test("invoice navigation uses record identity before matching client names", () => {
  const lead = { _id: "lead-b", name: "Same Name", studioProjectId: { _id: "project-b" } };
  const invoices = [{ _id: "wrong", clientName: "Same Name", leadId: "lead-a" }, { _id: "right", clientName: "Old Name", studioProjectId: "project-b" }];
  assert.equal(invoiceForLead(invoices, lead)._id, "right");
  assert.equal(invoiceDestination(invoices, lead), "/admin/invoices/right");
});
test("ambiguous legacy names never choose an arbitrary invoice", () => {
  const lead = { _id: "lead", name: "Same Name" };
  assert.equal(invoiceForLead([{ _id: "a", clientName: lead.name }, { _id: "b", clientName: lead.name }], lead), null);
  assert.equal(invoiceForLead([{ _id: "a", clientName: lead.name, leadId: "other" }], lead), null);
});
test("new invoice links preserve enquiry, contact and project context", () => {
  const destination = invoiceDestination([], { _id: "lead", contactId: { _id: "contact" }, studioProjectId: "project" });
  assert.equal(destination, "/admin/invoices/new?lead=lead&contact=contact&project=project");
});
test("legacy service and deliverable values survive invoice PDF migration", () => {
  const items = invoiceRows({ events: [{ eventName: "Wedding", services: "Photography", price: 123.45 }], deliverables: ["Album"], deliverablesPrice: 50 });
  assert.equal(items.reduce((sum, item) => sum + item.quantity * item.unitPricePaise, 0), 17345);
  assert.equal(items[1].description, "Album");
});
