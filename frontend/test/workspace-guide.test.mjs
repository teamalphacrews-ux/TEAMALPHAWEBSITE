import test from 'node:test';
import assert from 'node:assert/strict';
import { DOC_GUIDES } from '../src/saas/productDocsContent.js';
import { workspaceGuideTarget } from '../src/utils/workspaceGuide.js';

test('workspace pages and record-specific handoffs open documented steps', () => {
  const pages = ['', 'crm', 'contacts', 'clients', 'studio-projects', 'projects', 'gallery', 'quotations',
    'quote-templates', 'templates', 'invoices', 'finance', 'crew', 'calendar', 'shoot-day', 'post-production',
    'chats', 'email', 'whatsapp', 'settings', 'data', 'offline-drafts', 'activity-log', 'integrations',
    'users', 'workspace', 'subscription', 'contacts/client', 'studio-projects/job', 'invoices/new'];
  const contextual = [
    ['crm', '?lead=one', 'enquiries#follow-through'],
    ['studio-projects/job', '?tab=delivery', 'post-production-delivery#publish'],
    ['studio-projects/job', '?tab=payments', 'payment-schedules#receipts'],
    ['studio-projects/job', '?tab=documents', 'client-smart-link#prepare'],
    ['quotations', '?quote=one', 'quotations#review-share'],
    ['finance', '?view=ledger', 'finance#transactions'],
    ['workspace', '?tab=team', 'team-access#accounts'],
    ['workspace', '?tab=subscription', 'team-access#plan'],
    ['settings', '?section=automation', 'studio-settings#automation'],
    ['settings', '?section=production', 'post-production-delivery#templates'],
  ];
  const check = target => {
    const [slug, id] = target.split('#');
    const section = DOC_GUIDES.find(guide => guide.slug === slug)?.sections.find(item => item.id === id);
    assert.ok(section?.steps?.length, target);
  };
  for (const page of pages) check(workspaceGuideTarget('/admin/' + page));
  for (const [page, search, expected] of contextual) {
    assert.equal(workspaceGuideTarget('/admin/' + page, search), expected);
    check(expected);
  }
  assert.equal(workspaceGuideTarget('/admin/unknown'), null);
  assert.equal(workspaceGuideTarget('/quote/private-token'), null);
});
