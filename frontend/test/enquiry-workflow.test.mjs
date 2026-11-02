import test from 'node:test';
import assert from 'node:assert/strict';
import { enquiryProjectId, enquiryQuoteId, enquiryProjectDestination, enquiryQuoteDestination } from '../src/utils/enquiryWorkflow.js';
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
