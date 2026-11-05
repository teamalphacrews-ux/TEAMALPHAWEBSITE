const test = require('node:test');
const assert = require('node:assert/strict');
const Invoice = require('../models/Invoice'), Task = require('../models/Task'), Lead = require('../models/Lead'), StudioConfig = require('../models/StudioConfig');
const { projectView, assertClientChat, publicTask } = require('../services/clientProject');
const task = { _id: 't1', clientVisible: true, lead: 'l1', clientTitle: 'Wedding photos', deliveryType: 'Photos', productionStage: 'Uploaded to Drive', deliveryUrl: 'https://drive.google.com/example', clientUpdate: 'Ready for review', dueDate: '2026-12-01', assignee: { name: 'Editor', specialty: 'Editing', email: 'private@example.com' } };
test('server hides payments, crew, progress fields and delivery URLs according to snapshot options', async t => {
  t.mock.method(Invoice, 'findOne', async () => ({ documentStatus: 'Sent', status: 'Pending', total: 1000, paymentSchedule: [{ amountPaise: 100000 }], issuer: { bankDetails: 'PRIVATE BANK' } }));
  t.mock.method(StudioConfig, 'findOne', async () => ({ studioName: 'Team Alpha' }));
  t.mock.method(Lead, 'findById', async () => ({ _id: 'l1', studioProjectId: 'p1' }));
  t.mock.method(Task, 'find', () => ({ populate() { return this; }, sort: async () => [task] }));
  const value = await projectView({ _id: 'q1', invoiceId: 'i1', lead: 'l1', studioProjectId: 'p1', clientLinkOptions: { showPayments: false, showCrew: false, showProgress: false, showDeliverables: false, allowChat: false } });
  assert.deepEqual(value.invoice, { state: 'hidden' }); assert.deepEqual(value.crew, []); assert.deepEqual(value.production.deliveries, []); assert.equal(value.production.state, 'hidden');
  assert.ok(!JSON.stringify(value).includes('PRIVATE BANK')); assert.ok(!JSON.stringify(value).includes('Editor'));
  const row = publicTask(task, { showCrew: false, showProgress: false, showDeliverables: false });
  for (const key of ['stage', 'update', 'dueDate', 'updatedAt']) assert.equal(row[key], undefined);
  assert.equal(row.url, ''); assert.equal(row.crew, null);
});
test('chat disabled on a project is rejected on the server', async () => {
  await assert.rejects(() => assertClientChat({ clientLinkOptions: { allowChat: false } }), { status: 403 });
  await assertClientChat({ clientLinkOptions: { allowChat: true } });
});
