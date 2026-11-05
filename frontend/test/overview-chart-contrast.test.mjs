import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map(channel => parseInt(channel, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels.reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
function declarations(css, selector) {
  const block = css.slice(css.indexOf(selector));
  return Object.fromEntries([...block.slice(block.indexOf('{'), block.indexOf('}')).matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})/gi)].map(([, key, value]) => [key, value]));
}

test('live and product-preview chart tokens retain AA text and distinguishable data boundaries', () => {
  const sources = [
    ['../src/admin/pages/overviewReference.css', '.studio-app.studio-app .studio-overview-reference', 'html[data-studio-appearance=dark]'],
    ['../src/saas/productOverview.css', '.sos-overview-preview', '.sos-overview-preview.is-dark'],
  ];
  for (const [file, lightSelector, darkSelector] of sources) {
    const css = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const [selector, surface] of [[lightSelector, '#ffffff'], [darkSelector, '#202124']]) {
      const tokens = declarations(css, selector);
      for (const token of ['--ov-change-positive', '--ov-change-negative']) {
        assert.ok(contrast(tokens[token], surface) >= 4.5, `${file} ${selector} ${token}`);
      }
      for (const token of ['--ov-bar', '--ov-track-edge', '--ov-accent-edge']) {
        assert.ok(contrast(tokens[token], surface) >= 3, `${file} ${selector} ${token}`);
      }
    }
  }
});
