import test from "node:test";
import assert from "node:assert/strict";
import { paidAmount, remainingAmount, mergeLead, populatedTasks, initials } from "../src/admin/components/studio/leadUtils.js";

test("payment summaries follow the same lifecycle as Finance", () => {
  const project = { totalAmount: 100000, depositAmount: 25000, paymentStatus: "Unpaid" };
  assert.equal(paidAmount(project), 0, "an entered deposit is not received until its payment status is recorded");
  assert.equal(remainingAmount(project), 100000);
  assert.equal(paidAmount({ ...project, paymentStatus: "Deposit Paid" }), 25000);
  assert.equal(remainingAmount({ ...project, paymentStatus: "Deposit Paid" }), 75000);
  assert.equal(paidAmount({ ...project, paymentStatus: "Paid" }), 100000);
  assert.equal(remainingAmount({ ...project, paymentStatus: "Paid" }), 0);
  assert.equal(remainingAmount({ ...project, depositAmount: 120000, paymentStatus: "Deposit Paid" }), 0, "legacy overpayments never display a negative balance");
});

test("saving lead details retains task content while respecting server removals", () => {
  const taskA = { _id: "a", title: "Confirm venue", status: "pending" };
  const taskB = { _id: "b", title: "Send gallery", status: "completed" };
  const previous = { _id: "lead", name: "Maya & Arjun", tasks: [taskA, taskB] };
  const merged = mergeLead(previous, { _id: "lead", notes: "Updated", tasks: ["b"] });
  assert.deepEqual(populatedTasks(merged), [taskB]);
  assert.equal(merged.notes, "Updated");
  assert.equal(merged.name, previous.name);
  assert.deepEqual(mergeLead(previous, { tasks: [] }).tasks, [], "an empty server list clears removed tasks");
  assert.deepEqual(mergeLead(previous, { notes: "Only notes changed" }).tasks, previous.tasks);
  assert.deepEqual(mergeLead(previous, { tasks: [{ ...taskA, status: "completed" }] }).tasks, [{ ...taskA, status: "completed" }], "populated task updates replace stale content");
});

test("couple initials skip separators and support non-Latin names", () => {
  assert.equal(initials("Maya & Arjun"), "MA");
  assert.equal(initials("Riya / Karan"), "RK");
  assert.equal(initials("  Anika  "), "A");
  assert.equal(initials("मीरा & अर्जुन"), "मअ");
  assert.equal(initials("& /"), "?");
});
