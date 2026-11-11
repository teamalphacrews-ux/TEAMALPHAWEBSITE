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
  assert.match(html, /rel="preload" as="font" type="font\/woff2" href="\/assets\/fonts\/manrope-latin-variable\.woff2" crossorigin="anonymous"/);
  assert.equal((html.match(/manrope-latin-variable\.woff2/g) || []).length, 1);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal(transformDeploymentHtml(html, { VITE_STUDIO_DEPLOYMENT: 'commercial' }), html);
});

test('commercial font loading is local while personal typography stays independent', () => {
  const html = transformDeploymentHtml(personalHtml, { VITE_STUDIO_DEPLOYMENT: 'commercial' });
  assert.doesNotMatch(html, /https:\/\/fonts\.(?:googleapis|gstatic)\.com|Playfair/);
  assert.match(html, /font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap/);
  assert.match(html, /src:url\('\/assets\/fonts\/inter-latin-ext-variable\.woff2'\)/);
  assert.equal((html.match(/id="studio-commercial-fonts"/g) || []).length, 1);
  assert.equal((html.match(/href="\/assets\/fonts\/inter-latin-variable\.woff2"/g) || []).length, 1);

  for (const path of ['inter-latin-variable.woff2', 'inter-latin-ext-variable.woff2']) {
    const bytes = readFileSync(new URL(`../public/assets/fonts/${path}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', `${path} must be a WOFF2 asset`);
  }
  assert.match(readFileSync(new URL('../public/assets/fonts/Inter-OFL.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.equal(transformDeploymentHtml(personalHtml), personalHtml);
});

test('commercial font cleanup leaves unrelated third-party resources intact', () => {
  const source = personalHtml.replace('</head>', '<link rel="preconnect" href="https://images.example.com" />\n</head>');
  const html = transformDeploymentHtml(source, { VITE_STUDIO_DEPLOYMENT: 'commercial' });
  assert.match(html, /href="https:\/\/images\.example\.com"/);
});
