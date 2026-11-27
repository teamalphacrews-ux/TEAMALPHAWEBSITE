const test = require('node:test');
const assert = require('node:assert/strict');
const { quotation } = require('../utils/studioRecords');
const { basisPointAmount } = require('../utils/paise');
const { invoiceFromQuote } = require('../utils/quoteLifecycle');
const invoiceValues = require('../utils/invoiceValues');
const { runInvoiceDeliveryJobs } = require('../services/invoiceDelivery');
const financeRoutes = require('../routes/financeRoutes');
const Invoice = require('../models/Invoice');
const Finance = require('../models/Finance');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');

const input = {
  clientName: 'Sample Client', email: 'client@example.test', title: 'Test service',
  items: [{ title: 'Service', quantity: 1, unitPricePaise: 250 }],
};

async function controller(method, path, body = {}) {
  const route = financeRoutes.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
  await route.stack.at(-1).handle({ body, params: { id: '507f1f77bcf86cd799439022' } }, res);
  return res;
}

function rows(data) {
  return { select() { return this; }, sort() { return this; }, async lean() { return data; } };
}

test('quotes and converted invoices round the same half-paise percentage discount', () => {
  const quote = quotation({ ...input, discountType: 'percent', discountValue: 64.6 });
  assert.equal(quote.discountPaise, 162);
  assert.equal(quote.totalPaise, 88);
  const invoice = invoiceFromQuote({ ...quote, acceptedAt: '2026-10-23' });
  assert.equal(invoice.total, 0.88);
  assert.equal(invoiceValues(invoice).total, invoice.total);
});

test('existing accepted quotations retain their historical discount and total on conversion', () => {
  const quote = { ...quotation({ ...input, discountType: 'percent', discountValue: 64.6 }),
    discountPaise: 161, totalPaise: 89, acceptedAt: '2026-10-23' };
  const invoice = invoiceFromQuote(quote);
  assert.equal(invoice.discountType, 'fixed');
  assert.equal(invoice.discountValue, 1.61);
  assert.equal(invoiceValues(invoice).total, 0.89);
});

test('allowed quotation subtotals use exact arithmetic near half-paise boundaries', () => {
  const amount = 39999999995001;
  for (const rate of [1, 5001, 9999, 10000]) {
    const numerator = BigInt(amount) * BigInt(rate);
    assert.equal(basisPointAmount(amount, rate), Number((numerator + 5000n) / 10000n));
    assert.equal(basisPointAmount(amount, rate, Math.floor), Number(numerator / 10000n));
  }
});

test('a saved large accepted quotation supports invoice approval and collection within its agreed subtotal', () => {
  const item = { title: 'Studio services', unitPricePaise: 1000000000, quantity: 1000 };
  const quote = quotation({ ...input, items: [item, item] });
  const existing = invoiceFromQuote({ ...quote, _id: '507f1f77bcf86cd799439022', acceptedAt: '2026-10-23' });
  assert.equal(invoiceValues({}, existing).total, 20000000000);
  assert.equal(invoiceValues({ advancePaid: 15000000000 }, existing).advancePaid, 15000000000);
  assert.throws(() => invoiceValues({ items: [item, item, item] }, existing), { status: 400 });
  assert.throws(() => invoiceValues(existing), { status: 400 });
});

test('a one-paise accepted quote generates an editable single-due-date invoice', () => {
  const quote = quotation({ ...input, items: [{ title: 'Print', quantity: 1, unitPricePaise: 1 }] });
  const studio = { billingDefaults: { paymentScheduleEnabled: true, paymentMilestones: [
    { label: 'Booking', percent: 50, offsetDays: 0 }, { label: 'Balance', percent: 50, offsetDays: 15 },
  ] } };
  const invoice = invoiceFromQuote({ ...quote, acceptedAt: '2026-10-23' }, studio);
  assert.equal(invoice.total, 0.01);
  assert.equal(invoice.paymentScheduleEnabled, false);
  assert.deepEqual(invoice.paymentSchedule, []);
  assert.equal(invoiceValues(invoice).total, invoice.total);
});

test('legacy invoice migration subtracts prior tax exactly and sub-paise input fails', () => {
  const data = { clientName: input.clientName, invoiceDate: '2026-10-23', items: input.items };
  const legacy = { sourceQuotation: '507f1f77bcf86cd799439022', extraCharges: 0.30, taxAmount: 0.20 };
  assert.equal(invoiceValues(data, legacy).extraCharges, 0.10);
  assert.throws(() => invoiceValues({ ...data, advancePaid: 0.00000001 }), { status: 400 });
});

test('reminder checks operate in integer paise and handle absent historical advances', async t => {
  // No SMTP delivery is permitted. Each attempted claim returns modifiedCount zero.
  t.mock.method(Invoice, 'updateMany', async () => ({}));
  for (const key of ['EMAIL_USER', 'EMAIL_PASS']) {
    const previous = process.env[key];
    process.env[key] = 'isolated-test-only';
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const invoice = { _id: 'covered', total: 0.30, reminderOffsets: [0], paymentScheduleEnabled: true,
    paymentSchedule: [{ amountPaise: 29, dueDate: today }, { amountPaise: 1, dueDate: '2099-12-31' }], advancePaid: 0.29 };
  t.mock.method(Invoice, 'find', filter => ({
    select() { return this; },
    async limit() { return filter.paymentReminders ? [invoice, { ...invoice, _id: 'unpaid', advancePaid: undefined }] : []; },
  }));
  const attempts = [];
  t.mock.method(Invoice, 'updateOne', async filter => { attempts.push(filter._id); return { modifiedCount: 0 }; });
  await runInvoiceDeliveryJobs();
  assert.deepEqual(attempts, ['unpaid']);
});

test('finance overview and pending balances include partial collections with exact decimals', async t => {
  const partial = { _id: 'partial', status: 'Pending', total: 100.30, advancePaid: 20.10, invoiceDate: '2026-10-23' };
  const paid = { status: 'Paid', total: 10.20 };
  t.mock.method(Invoice, 'find', filter => {
    assert.deepEqual(filter.documentStatus.$nin, ['Draft', 'Cancelled', 'Archived']);
    return rows(filter.status.$nin ? [partial] : [partial, paid]);
  });
  t.mock.method(Lead, 'find', () => rows([]));
  t.mock.method(Finance, 'find', () => rows([{ amount: 0.1 }, { amount: 0.2 }]));
  assert.deepEqual((await controller('get', '/overview')).data, {
    annualSales: 30.30, annualProfit: 30, expenses: 0.30, pendingRevenue: 80.20,
  });
  const [item] = (await controller('get', '/pending-payments')).data;
  assert.equal(item.paid, 20.10);
  assert.equal(item.pending, 80.20);
  assert.equal(item.status, 'Part paid');
});

test('expense allocation includes custom and uncategorized categories in the displayed total', async t => {
  t.mock.method(Finance, 'aggregate', async () => [{ _id: 'Travel', total: 7.5 }, { _id: 'Props', total: 1.5 }, { _id: null, total: 1 }]);
  const { data } = await controller('get', '/allocation');
  assert.deepEqual(data.filter(item => item.value).map(item => [item.label, item.progress]), [['Travel', 75], ['Props', 15], ['General', 10]]);
});

test('expense writes validate money, target expense rows and survive a notification failure', async t => {
  for (const amount of [0, -2, 1.001, Infinity]) {
    assert.ok(new Finance({ type: 'expense', amount }).validateSync()?.errors.amount);
  }
  assert.equal(new Finance({ type: 'expense', amount: 0.29 }).validateSync(), undefined);
  let saves = 0;
  t.mock.method(Finance.prototype, 'save', async function() { saves++; return this; });
  t.mock.method(Notification, 'create', async () => { throw new Error('Test activity outage'); });
  const created = await controller('post', '/expense', { title: 'Sample expense', amount: 0.29 });
  assert.equal(created.code, 200);
  assert.equal(saves, 1);
  t.mock.method(Finance, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.type, 'expense');
    assert.equal(options.runValidators, true);
    return null;
  });
  assert.equal((await controller('put', '/expense/:id', { amount: 0.28 })).code, 404);
});
