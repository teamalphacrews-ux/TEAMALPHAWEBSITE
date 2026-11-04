import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStudioDeployment, transformDeploymentHtml, PRODUCT_METADATA } from '../src/saas/releaseConfig.js';
import { STUDIO_X_FAVICON, STUDIO_X_TOUCH_ICON } from '../src/utils/branding.js';

const personalHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('personal production remains the default, and local preview stays available', () => {
  assert.deepEqual(resolveStudioDeployment(), { isCommercial: false, saasReleaseEnabled: false });
  assert.deepEqual(resolveStudioDeployment({ DEV: true }), { isCommercial: false, saasReleaseEnabled: true });
  assert.deepEqual(resolveStudioDeployment({ VITE_STUDIO_SAAS_ENABLED: 'true' }), { isCommercial: false, saasReleaseEnabled: true });
  assert.deepEqual(resolveStudioDeployment({ VITE_STUDIO_DEPLOYMENT: 'unknown' }), { isCommercial: false, saasReleaseEnabled: false });
});

test('commercial mode opts into product routes independently of backend account gates', () => {
  assert.deepEqual(resolveStudioDeployment({ VITE_STUDIO_DEPLOYMENT: 'commercial', VITE_STUDIO_SAAS_ENABLED: 'false', SAAS_SIGNUP_ENABLED: 'false' }), { isCommercial: true, saasReleaseEnabled: true });
});

test('personal HTML and original banner preload are unchanged without commercial opt-in', () => {
  assert.equal(transformDeploymentHtml(personalHtml), personalHtml);
  assert.equal(transformDeploymentHtml(personalHtml, { DEV: true }), personalHtml);
  assert.equal(transformDeploymentHtml(personalHtml, { VITE_STUDIO_SAAS_ENABLED: 'true' }), personalHtml);
});

test('commercial HTML starts with product identity and does not preload personal hero media', () => {
  const html = transformDeploymentHtml(personalHtml, { VITE_STUDIO_DEPLOYMENT: 'commercial' });
  assert.ok(html.includes(`<title>${PRODUCT_METADATA.title}</title>`));
  assert.ok(html.includes(`href="${STUDIO_X_FAVICON}"`));
  assert.ok(html.includes(`href="${STUDIO_X_TOUCH_ICON}"`));
  assert.ok(html.includes('Explore the commercial product preview.'));
  assert.ok(html.includes('client smart link.'));
  assert.ok(html.includes(`content="${PRODUCT_METADATA.themeColor}"`));
  assert.doesNotMatch(html, /team-alpha-(?:favicon|apple-touch)|The Wedding Artist|assets\/banner\//);
  assert.match(html, /name="viewport"/);
  assert.match(html, /src="\/src\/main.jsx"/);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal(transformDeploymentHtml(html, { VITE_STUDIO_DEPLOYMENT: 'commercial' }), html);
});
