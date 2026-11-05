import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import RouteErrorBoundary, { readRecoveryAppearance } from '../src/components/RouteErrorBoundary.js';

const fallback = () => null;
const makeBoundary = resetKey => new RouteErrorBoundary({ resetKey, fallback, children: createElement('div', { id: 'workspace' }) });

test('healthy navigation preserves the existing subtree element and does not use a remount key', () => {
  const boundary = makeBoundary('/admin');
  const child = boundary.render();
  const next = RouteErrorBoundary.getDerivedStateFromProps({ resetKey: '/admin/calendar' }, boundary.state);
  boundary.state = { ...boundary.state, ...next };
  assert.equal(boundary.render(), child);
  assert.equal(boundary.render().key, null);
  assert.equal(boundary.state.failed, false);
});

test('an error exposes only recovery presentation, never the thrown value or record details', () => {
  const change = RouteErrorBoundary.getDerivedStateFromError(new Error('private token and record'));
  assert.deepEqual(Object.keys(change).sort(), ['appearance', 'failed']);
  assert.equal(change.failed, true);
  const boundary = makeBoundary('/quote/private-capability');
  boundary.state = { ...boundary.state, ...change };
  const result = boundary.render();
  assert.equal(result.type, fallback);
  assert.deepEqual(Object.keys(result.props).sort(), ['appearance', 'onRetry']);
  assert.equal(JSON.stringify(result.props).includes('private'), false);
});

test('same route rerenders preserve the failure until explicit retry', () => {
  const boundary = makeBoundary('/admin/quotations?quote=123');
  boundary.state.failed = true;
  assert.equal(RouteErrorBoundary.getDerivedStateFromProps({ resetKey: '/admin/quotations?quote=123' }, boundary.state), null);
  assert.equal(boundary.render().type, fallback);
});

test('navigation to another pathname or query clears an old failure', () => {
  for (const resetKey of ['/admin', '/admin/quotations?quote=456']) {
    const boundary = makeBoundary('/admin/quotations?quote=123');
    boundary.state.failed = true;
    const next = RouteErrorBoundary.getDerivedStateFromProps({ resetKey }, boundary.state);
    assert.deepEqual(next, { failed: false, resetKey });
    boundary.state = { ...boundary.state, ...next };
    assert.equal(boundary.render(), boundary.props.children);
  }
});

test('retry reopens only the failed subtree and preserves the route', () => {
  const boundary = makeBoundary('/admin/settings');
  boundary.state.failed = true;
  boundary.setState = update => { boundary.state = { ...boundary.state, ...update }; };
  boundary.render().props.onRetry();
  assert.equal(boundary.state.failed, false);
  assert.equal(boundary.state.resetKey, '/admin/settings');
  assert.equal(boundary.render(), boundary.props.children);
});

test('recovery adopts workspace dark/light presentation and is safe without a document', () => {
  assert.equal(readRecoveryAppearance(), 'light');
  assert.equal(readRecoveryAppearance({ getAttribute: name => name === 'data-studio-appearance' ? 'dark' : null }), 'dark');
  assert.equal(readRecoveryAppearance({ getAttribute: name => name === 'data-studio-browser-theme' ? 'dark' : null }), 'dark');
  assert.equal(readRecoveryAppearance({ getAttribute: () => 'light' }), 'light');
});
