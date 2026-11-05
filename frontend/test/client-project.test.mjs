import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentRows } from '../src/utils/clientProjectData.js';
test('client payment schedule allocates studio-confirmed receipts without double counting booking deposits', () => {
  const rows = paymentRows({ total: 3000, advancePaid: 1200, paymentScheduleEnabled: true, paymentSchedule: [{ amountPaise: 100000, dueDate: '2026-10-01' }, { amountPaise: 200000, dueDate: '2026-11-01' }], depositAmount: 9999 }, new Date('2026-10-20T00:00:00Z'));
  assert.deepEqual(rows.map(row => row.remaining), [0, 180000]);
  assert.deepEqual(rows.map(row => row.state), ['Paid', 'Upcoming']);
});
test('paid invoices clear every installment and Indian due-day boundaries stay correct', () => {
  assert.equal(paymentRows({ total: 100, status: 'Paid', advancePaid: 1, dueDate: '2026-10-20' })[0].remaining, 0);
  const row = paymentRows({ total: 100, dueDate: '2026-10-20' }, new Date('2026-10-19T19:00:00Z'))[0];
  assert.equal(row.state, 'Due today');
});
