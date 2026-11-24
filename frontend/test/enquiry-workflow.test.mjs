import test from 'node:test';
import assert from 'node:assert/strict';
import { enquiryNextStep, enquiryProjectId, enquiryQuoteId, enquiryProjectDestination, enquiryQuoteDestination } from '../src/utils/enquiryWorkflow.js';
test('enquiry actions resolve saved and populated links without losing the same client/project', () => {
  assert.equal(enquiryProjectId({ studioProjectId: { _id: 'project1' } }), 'project1');
  assert.equal(enquiryQuoteId({ quotationId: 'quote1' }), 'quote1');
  assert.equal(enquiryProjectDestination({ _id: 'project1' }), '/admin/studio-projects/project1');
  const path = enquiryQuoteDestination({ lead: { _id: 'lead1' }, project: { _id: 'project1', contactId: { _id: 'contact1' } } });
  const query = new URL('https://example.test' + path).searchParams;
  assert.equal(query.get('contact'), 'contact1'); assert.equal(query.get('project'), 'project1');
  assert.equal(query.has('new'), false, 'generic new mode must not erase client prefill');
});
test('existing enquiry quotation opens directly, while incomplete linkage cannot start an unlinked quote', () => {
  assert.equal(enquiryQuoteDestination({ lead: { quotationId: { _id: 'quote1' } } }), '/admin/quotations?quote=quote1');
  assert.throws(() => enquiryQuoteDestination({ lead: {}, project: { _id: 'project1' } }));
  assert.throws(() => enquiryProjectDestination(null));
});

const access = { canProject: true, canQuote: true, today: '2026-11-22' };
test('enquiry guidance follows its actual stage, prioritises a due follow-up, and respects access', () => {
  assert.equal(enquiryNextStep({ status: 'New' }, access).label, 'Set follow-up');
  assert.equal(enquiryNextStep({ status: 'Meeting', followUpDate: '2026-11-22T00:00:00Z' }, access).action, 'followup');
  assert.equal(enquiryNextStep({ status: 'Meeting', followUpDate: '2026-11-23T00:00:00Z' }, access).action, 'quote');
  assert.equal(enquiryNextStep({ status: 'Negotiation' }, { ...access, canQuote: false }).action, 'followup');
  const sent = { status: 'Meeting', quotationId: { _id: 'q', status: 'Sent' } };
  assert.match(enquiryNextStep(sent, access).description, /awaiting a response/);
  assert.equal(enquiryNextStep({ ...sent, status: 'Converted' }, access).action, 'project');
  assert.equal(enquiryNextStep({ ...sent, status: 'Converted' }, { ...access, canProject: false }).action, undefined);
  assert.equal(enquiryNextStep({ ...sent, status: 'Archived' }, access).action, undefined);
});

test('read-only enquiry guidance opens recorded work and never offers a write', () => {
  const read = { ...access, canUpdate: false };
  assert.equal(enquiryNextStep({ status: 'New' }, read).action, undefined);
  assert.equal(enquiryNextStep({ status: 'Negotiation', followUpDate: '2026-11-21' }, read).action, undefined);
  assert.equal(enquiryNextStep({ status: 'Converted' }, read).action, undefined);
  assert.equal(enquiryNextStep({ status: 'Converted', studioProjectId: 'p' }, read).action, 'project');
  assert.equal(enquiryNextStep({ status: 'Meeting', quotationId: 'q' }, read).action, 'quote');
  assert.equal(enquiryNextStep({ status: 'Archived', quotationId: 'q' }, read).action, undefined);
});
