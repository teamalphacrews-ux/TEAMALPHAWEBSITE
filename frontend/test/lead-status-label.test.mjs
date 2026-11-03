import test from 'node:test';
import assert from 'node:assert/strict';
import { leadStatusLabel, LEAD_STATUSES, statusClass, matchesLeadStage } from '../src/admin/components/studio/leadUtils.js';

test('Converted displays as Booked while the stored stage remains Converted', () => {
  assert.equal(leadStatusLabel('Converted'), 'Booked');
  assert.ok(LEAD_STATUSES.includes('Converted'));
  assert.ok(!LEAD_STATUSES.includes('Booked'));
  assert.equal(statusClass('Converted'), 'success');
  const lead = { status: 'Converted' };
  leadStatusLabel(lead.status);
  assert.equal(lead.status, 'Converted');
});

test('other stages retain their labels and missing stages share the New fallback', () => {
  for (const status of LEAD_STATUSES.filter(status => status !== 'Converted')) assert.equal(leadStatusLabel(status), status);
  assert.equal(leadStatusLabel(undefined), 'New');
  assert.equal(leadStatusLabel(''), 'New');
  assert.equal(leadStatusLabel('Custom stage'), 'Custom stage');
});

test('active enquiry drill-down matches the dashboard population without adding a stored stage', () => {
  const leads = LEAD_STATUSES.map(status => ({ status }));
  assert.deepEqual(leads.filter(lead => matchesLeadStage(lead, 'Active')).map(lead => lead.status), ['New', 'Follow-up', 'Meeting', 'Negotiation']);
  assert.equal(leads.filter(lead => matchesLeadStage(lead, 'All')).length, 6);
  assert.deepEqual(leads.filter(lead => matchesLeadStage(lead, 'Converted')), [{ status: 'Converted' }]);
  assert.ok(!LEAD_STATUSES.includes('Active'));
});
