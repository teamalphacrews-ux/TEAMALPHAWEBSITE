import test from 'node:test';
import assert from 'node:assert/strict';
import { overviewFinanceTotals } from '../src/admin/components/finance/overviewFinanceData.js';
import { defaultOverviewPreferences, normalizeOverviewPreferences } from '../src/utils/overviewPreferences.js';

const now = new Date('2026-10-23T20:00:00Z'); // Already 24 October in Bengaluru.
test('finance card includes today in due amounts and applies advances to earliest scheduled payments', () => {
  const totals = overviewFinanceTotals([], [{ documentStatus: 'Sent', status: 'Pending', total: 1000, advancePaid: 150, paymentScheduleEnabled: true,
    paymentSchedule: [{ dueDate: '2026-10-26', amountPaise: 50000 }, { dueDate: '2026-10-24', amountPaise: 30000 }, { dueDate: '2026-10-20', amountPaise: 20000 }] }], now);
  assert.equal(totals.due, 350); assert.equal(totals.upcoming, 500);
});
test('drafts, cancelled documents and paid invoices cannot inflate collections; foreign currencies are not silently converted', () => {
  const invoices = [{ total: 100, documentStatus: 'Draft' }, { total: 100, documentStatus: 'Cancelled' }, { total: 100, documentStatus: 'Archived' },
    { total: 100, documentStatus: 'Sent', status: 'Paid' }, { total: 100, status: 'Cancelled' }, { total: 50, documentStatus: 'Sent', currency: 'USD' },
    { total: 10.01, documentStatus: 'Sent' }];
  const totals = overviewFinanceTotals([], invoices, now);
  assert.equal(totals.due, 0); assert.equal(totals.upcoming, 10.01); assert.equal(totals.excludedCurrencies, 1);
});
test('profit uses confirmed ledger cash only, without adding invoice deposits again, and supports a loss', () => {
  const entries = [{ type: 'income', status: 'Received', amount: 100.1 }, { type: 'income', status: 'Paid', amount: 20.2 },
    { type: 'income', status: 'Pending', amount: 5000 }, { type: 'expense', status: 'Paid', amount: 200.4 },
    { type: 'expense', status: 'Pending', amount: 999 }, { type: 'income', status: 'Received', amount: 'invalid' }];
  const totals = overviewFinanceTotals(entries, [{ total: 1000, advancePaid: 200, documentStatus: 'Sent' }], now);
  assert.equal(totals.income, 120.3); assert.equal(totals.expenses, 200.4); assert.equal(totals.netProfit, -80.1);
});
test('malformed legacy schedules fall back to the invoice deadline rather than double counting', () => {
  const totals = overviewFinanceTotals([], [{ total: 100, advancePaid: 25, documentStatus: 'Sent', dueDate: '2026-10-23', paymentScheduleEnabled: true, paymentSchedule: [{ amountPaise: 5000, dueDate: '2026-12-01' }] }], now);
  assert.equal(totals.due, 75); assert.equal(totals.upcoming, 0);
});
test('old nonempty layouts gain Finance once, while an empty dashboard and later opt-outs are preserved', () => {
  assert.ok(normalizeOverviewPreferences({ visibleCards: ['bookingMomentum'] }).visibleCards.includes('financePulse'));
  assert.deepEqual(normalizeOverviewPreferences({ visibleCards: [] }).visibleCards, []);
  assert.deepEqual(normalizeOverviewPreferences({ layoutVersion: 2, visibleCards: ['bookingMomentum'] }).visibleCards, ['bookingMomentum']);
  assert.equal(defaultOverviewPreferences().visibleCards.length, 12);
});
