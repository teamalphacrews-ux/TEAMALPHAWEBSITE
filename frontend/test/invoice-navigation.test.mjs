import test from "node:test";
import assert from "node:assert/strict";
import { invoiceForLead, invoiceDestination, invoiceEditorKey, loadInvoiceRecord } from "../src/admin/components/operations/invoiceNavigation.js";
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

test('switching invoices, projects, clients or workspaces replaces the whole editor; a newly saved invoice keeps its pending review', () => {
  const location = { key: 'visit1', search: '?contact=a&project=p1' };
  const scope = 'owner:studio', other = 'owner:studio2';
  const a = invoiceEditorKey(scope, 'A', location);
  const b = invoiceEditorKey(scope, 'B', location);
  assert.notEqual(a, b);
  assert.notEqual(a, invoiceEditorKey(other, 'A', location));
  const newKey = invoiceEditorKey(scope, undefined, location);
  assert.notEqual(newKey, invoiceEditorKey(scope, undefined, { ...location, search: '?contact=b&project=p2' }));
  const promoted = { scope, key: newKey, id: 'B' };
  const saved = { key: 'visit2', search: '' };
  assert.equal(invoiceEditorKey(scope, 'B', saved, promoted), newKey);
  assert.notEqual(invoiceEditorKey(scope, 'A', saved, promoted), newKey);
  assert.notEqual(invoiceEditorKey(other, 'B', saved, promoted), newKey);
  assert.notEqual(invoiceEditorKey(scope, undefined, saved, promoted), newKey);
});

test('retry loads only the requested invoice after a failed or mismatched response', async () => {
  const calls = [];
  const get = reply => async (method, path) => {
    calls.push([method, path]);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  assert.deepEqual(await loadInvoiceRecord('A', get({ _id: 'A' })), { _id: 'A' });
  await assert.rejects(loadInvoiceRecord('B', get(new Error('Unavailable'))), /Unavailable/);
  await assert.rejects(loadInvoiceRecord('B', get({ _id: 'A' })), /could not be verified/);
  assert.deepEqual(await loadInvoiceRecord('B', get({ _id: 'B' })), { _id: 'B' });
  assert.deepEqual(calls.map(call => call[1]), ['/api/invoices/A', '/api/invoices/B', '/api/invoices/B', '/api/invoices/B']);
  assert.ok(calls.every(call => call[0] === 'get'));
});
