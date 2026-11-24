import assert from "node:assert/strict";
import test from "node:test";
import {
  invoiceCreationKey,
  invoiceEdits,
  rebaseInvoiceEdits,
} from "../src/admin/components/operations/invoiceSave.js";

test("editing notes excludes the old paid amount and internal invoice fields", () => {
  const invoice = { advancePaid: 100.11, notes: "", editVersion: 3, _id: "invoice" };
  const edited = { ...invoice, notes: "Check delivery date." };
  assert.deepEqual(invoiceEdits(edited, invoice), { notes: "Check delivery date." });
  const latest = { ...invoice, advancePaid: 140.55, editVersion: 4 };
  assert.deepEqual(rebaseInvoiceEdits(edited, invoice, latest), {
    local: { notes: "Check delivery date." }, conflicts: [],
  });
  assert.deepEqual(rebaseInvoiceEdits({ ...edited, advancePaid: 130 }, invoice, latest).conflicts, ["advancePaid"]);
});

test("different server subdocument identifiers do not cause a fake invoice field conflict", () => {
  const item = { _id: "first", title: "Portraits", quantity: 1 };
  const base = { items: [item] };
  const local = { items: [{ ...item, quantity: 2 }] };
  const latest = { items: [{ ...item, _id: "new" }] };
  assert.deepEqual(rebaseInvoiceEdits(local, base, latest).conflicts, []);
});

test("creation key survives a refresh but changes on a distinct history entry or workspace", () => {
  const page = {
    state: { key: "old-entry", idx: 3 },
    replaceState(value) { this.state = value; },
  };
  const first = invoiceCreationKey("account:workspace", page);
  assert.match(first.key, /^[a-f0-9]{32}$/);
  assert.equal(first.restored, false);
  assert.deepEqual(invoiceCreationKey("account:workspace", page), { key: first.key, restored: true });
  assert.equal(page.state.key, "old-entry");
  assert.notEqual(invoiceCreationKey("account:other-workspace", page).key, first.key);
  page.state = { key: "other-entry", idx: 4 };
  assert.notEqual(invoiceCreationKey("account:workspace", page).key, first.key);
});
