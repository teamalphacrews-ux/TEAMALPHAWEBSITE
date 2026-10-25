import test from 'node:test';
import assert from 'node:assert/strict';
import { internationalWhatsAppPhone, openWhatsAppUrl, whatsappReplyWindow, whatsappMessageStatus, approvedTemplateDraft, confirmedWhatsAppSubmission, mergeWhatsAppMessages, refreshWhatsAppMessages, whatsappConnectionLabel } from '../src/utils/whatsappData.js';

test('WhatsApp links require an explicit international phone and cannot become arbitrary destinations', () => {
  assert.equal(internationalWhatsAppPhone('+91 (98765) 43210'), '+919876543210');
  assert.equal(openWhatsAppUrl('+91 (98765) 43210'), 'https://wa.me/919876543210');
  assert.equal(internationalWhatsAppPhone('+2901234'), '+2901234');
  for (const phone of ['9876543210', 'javascript:alert(1)', 'https://evil.test', '+00000000000', '+919876543210?text=secret', '+1', null]) assert.equal(openWhatsAppUrl(phone), '');
});
test('freeform reply controls use the actual server window and expire exactly at its boundary', () => {
  const until = '2026-10-26T12:00:00Z';
  assert.equal(whatsappReplyWindow({ windowExpiresAt: until }, Date.parse(until) - 1), true);
  assert.equal(whatsappReplyWindow({ windowExpiresAt: until }, Date.parse(until)), false);
  assert.equal(whatsappReplyWindow({ lastMessageAt: until }, Date.parse(until) - 1), false);
  assert.equal(whatsappReplyWindow({ windowExpiresAt: 'invalid' }), false);
});
test('unconfirmed provider delivery never appears as sent or paid', () => {
  assert.equal(whatsappMessageStatus({ direction: 'outbound', status: 'unknown' }), 'Delivery unconfirmed');
  assert.equal(whatsappMessageStatus({ direction: 'outbound', status: 'accepted' }), 'Accepted by WhatsApp');
  assert.equal(whatsappMessageStatus({ direction: 'outbound', status: 'submitted' }), 'Accepted by WhatsApp');
  assert.equal(confirmedWhatsAppSubmission('submitted'), true);
  for (const status of ['sending', 'unknown', 'pending', 'failed', 'unexpected']) assert.equal(confirmedWhatsAppSubmission(status), false);
  assert.equal(whatsappMessageStatus({ direction: 'outbound', status: 'unexpected' }), 'Delivery unconfirmed');
  assert.equal(whatsappMessageStatus({ direction: 'inbound', status: 'sent' }), 'Received');
  assert.equal(whatsappConnectionLabel({ configured: true, connected: false, state: 'coexistence_required' }), 'App connection needed');
});
test('template parameters must match the approved template and preview remains plain text', () => {
  const template = { body: 'Hello {{1}}, your link is {{2}}.', parameterCount: 2 };
  assert.deepEqual(approvedTemplateDraft(template, [' Maya ', 'https://example.test/quote/x']), { valid: true, parameters: ['Maya', 'https://example.test/quote/x'], preview: 'Hello Maya, your link is https://example.test/quote/x.' });
  assert.equal(approvedTemplateDraft(template, ['Maya', '']).valid, false);
  assert.equal(approvedTemplateDraft({ parameterCount: -1 }).valid, false);
  assert.equal(approvedTemplateDraft({ body: 'Hi {{1}}', parameterCount: 1 }, ['<img src=x onerror=alert(1)>']).preview, 'Hi <img src=x onerror=alert(1)>');
});
test('message polling merges provider status updates without duplicating a message or reordering history', () => {
  const first = { id: 'a', text: 'first', createdAt: '2026-10-25T10:00:00Z', status: 'accepted' };
  const next = { id: 'b', text: 'next', createdAt: '2026-10-25T10:01:00Z', status: 'delivered' };
  const merged = mergeWhatsAppMessages([next, first], [{ ...first, status: 'read' }, null]);
  assert.deepEqual(merged.map(message => [message.id, message.status]), [['a', 'read'], ['b', 'delivered']]);
  assert.equal(first.status, 'accepted');
});

test('a late request response cannot downgrade read or delivered receipt state', () => {
  const message = { id: 'a', direction: 'outbound', text: 'hello', createdAt: '2026-10-25T10:00:00Z', status: 'read' };
  assert.equal(mergeWhatsAppMessages([message], [{ ...message, status: 'submitted' }])[0].status, 'read');
  assert.equal(mergeWhatsAppMessages([{ ...message, status: 'failed' }], [{ ...message, status: 'sent' }])[0].status, 'failed');
  assert.equal(mergeWhatsAppMessages([{ ...message, status: 'failed' }], [{ ...message, status: 'delivered' }])[0].status, 'delivered');
});

test('authoritative latest pages remove duplicate echoes while retaining old history and a newer request', () => {
  const at = minute => `2026-10-25T10:${String(minute).padStart(2, '0')}:00Z`;
  const previous = [{ id: 'older', createdAt: at(0) }, { id: 'alias', createdAt: at(2) }, { id: 'latest', createdAt: at(3) }, { id: 'newer', createdAt: at(5) }];
  const incoming = [{ id: 'canonical', createdAt: at(2) }, { id: 'latest', createdAt: at(3) }];
  assert.deepEqual(refreshWhatsAppMessages(previous, incoming, { hasEarlier: true, requestedAt: Date.parse(at(4)) }).map(message => message.id), ['older', 'canonical', 'latest', 'newer']);
  assert.deepEqual(refreshWhatsAppMessages(previous, [], { requestedAt: Date.parse(at(4)) }).map(message => message.id), ['newer']);
});
