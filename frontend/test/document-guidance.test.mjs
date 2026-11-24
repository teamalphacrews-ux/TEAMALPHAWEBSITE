import test from 'node:test';
import assert from 'node:assert/strict';
import { documentClientContext, invoiceNextStep, quoteNextStep } from '../src/admin/components/operations/documentGuidance.js';

const client = { _id: 'client', firstName: 'Ana' };
const other = { _id: 'other', firstName: 'Lee' };
const projects = [{ _id: 'wedding', contactId: client, additionalClients: [other] }];
const resolve = query => documentClientContext(new URLSearchParams(query), projects, [client, other]);

test('project-only creation reuses the primary client and respects additional clients and unavailable records', () => {
  assert.deepEqual(resolve('project=wedding'), { projectId: 'wedding', contact: client });
  assert.deepEqual(resolve('project=wedding&contact=other'), { projectId: 'wedding', contact: other });
  assert.deepEqual(resolve('project=wedding&contact=unknown'), { projectId: '', contact: undefined });
  assert.deepEqual(resolve('project=unknown&contact=other'), { projectId: '', contact: other });
});

test('accepted quotes direct users to the linked invoice or register only with invoice access', () => {
  const quote = { status: 'Accepted', hasInvoice: true, canSeeInvoices: true };
  assert.equal(quoteNextStep(quote).action, 'invoice');
  assert.equal(quoteNextStep({ ...quote, invoicePending: true }).action, undefined);
  assert.equal(quoteNextStep({ ...quote, hasInvoice: false }).action, 'register');
  assert.equal(quoteNextStep({ ...quote, canSeeInvoices: false }).action, undefined);
  assert.equal(quoteNextStep({ ...quote, status: 'Open', linkRevoked: true }).title, 'Client link revoked');
  assert.equal(quoteNextStep({ ...quote, status: 'Expired' }).action, undefined);
});

test('draft invoice guidance follows missing client and items, then hands off to explicit issue', () => {
  const draft = { documentStatus: 'Draft', items: [] };
  assert.equal(invoiceNextStep(draft, 0).action, 'client');
  assert.equal(invoiceNextStep({ ...draft, clientName: 'Ana' }, 0).action, 'items');
  assert.equal(invoiceNextStep({ ...draft, clientName: 'Ana', items: [{ title: 'Wedding' }] }, 100).title, 'Review before issue');
  assert.equal(invoiceNextStep(draft, 0, true).action, undefined);
});

test('issued invoice guidance distinguishes share, collection, no balance, revoked and cancelled', () => {
  const invoice = { documentStatus: 'Sent', status: 'Pending', advancePaid: 0 };
  assert.equal(invoiceNextStep(invoice, 10000).title, 'Share the issued invoice');
  assert.equal(invoiceNextStep({ ...invoice, sourceQuotation: 'q' }, 10000).action, 'balance');
  assert.equal(invoiceNextStep({ ...invoice, sharedAt: '2026-01-01' }, 10000, true).action, undefined);
  assert.equal(invoiceNextStep({ ...invoice, advancePaid: 100 }, 10000).title, 'No balance left to collect');
  assert.equal(invoiceNextStep({ ...invoice, status: 'Paid' }, 10000).title, 'No balance left to collect');
  assert.equal(invoiceNextStep({ ...invoice, linkRevokedAt: '2026-01-01' }, 10000).title, 'Invoice link revoked');
  assert.equal(invoiceNextStep({ ...invoice, status: 'Cancelled' }, 10000).title, 'Invoice cancelled');
});
