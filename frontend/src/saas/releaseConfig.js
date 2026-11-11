import { STUDIO_X_FAVICON, STUDIO_X_TOUCH_ICON } from '../utils/branding.js';

export const PRODUCT_METADATA = Object.freeze({
  title: 'Studio X OS · Supercharge your photography business',
  description: 'The connected workspace for photography studios. Explore enquiries, quotes, invoices, crew, post-production and the client smart link.',
  socialDescription: 'Your clients, crew, money and creative work. One connected studio. Explore the commercial product preview.',
  themeColor: '#090a0e',
});

// Deployment identity changes routing, never server-side signup or billing gates.
export function resolveStudioDeployment(env = {}) {
  const isCommercial = env.VITE_STUDIO_DEPLOYMENT === 'commercial';
  return {
    isCommercial,
    saasReleaseEnabled: isCommercial || env.DEV === true || env.VITE_STUDIO_SAAS_ENABLED === 'true',
  };
}

const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const LOCAL_INTER_FACE = `<style id="studio-commercial-fonts">
@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/assets/fonts/inter-latin-ext-variable.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/assets/fonts/inter-latin-variable.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
</style>`;

function setMeta(html, attribute, key, value) {
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${key}["'])[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeAttribute(value)}" />`;
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}

// Runs before HTML is delivered; personal production HTML is left byte-identical.
export function transformDeploymentHtml(html, env = {}) {
  if (!resolveStudioDeployment(env).isCommercial) return html;
  let result = html.replace(/<title>[^<]*<\/title>/i, `<title>${PRODUCT_METADATA.title}</title>`);
  result = setMeta(result, 'name', 'description', PRODUCT_METADATA.description);
  result = setMeta(result, 'name', 'theme-color', PRODUCT_METADATA.themeColor);
  result = setMeta(result, 'property', 'og:title', PRODUCT_METADATA.title);
  result = setMeta(result, 'property', 'og:description', PRODUCT_METADATA.socialDescription);
  result = setMeta(result, 'property', 'og:type', 'website');
  result = result.replace(/<link\b(?=[^>]*\brel=["']icon["'])[^>]*>/i, `<link rel="icon" type="image/png" sizes="64x64" href="${STUDIO_X_FAVICON}" />`);
  result = result.replace(/<link\b(?=[^>]*\brel=["']apple-touch-icon["'])[^>]*>/i, `<link rel="apple-touch-icon" sizes="180x180" href="${STUDIO_X_TOUCH_ICON}" />`);
  const displayFont = '/assets/fonts/manrope-latin-variable.woff2';
  if (!result.includes(`href="${displayFont}"`)) {
    result = result.replace('</head>', `  <link rel="preload" as="font" type="font/woff2" href="${displayFont}" crossorigin="anonymous" />\n  </head>`);
  }
  // Personal typography stays untouched. Commercial UI needs Inter, but not a
  // third-party stylesheet or Playfair; other scripts retain system fallbacks.
  result = result.replace(/<link\b(?=[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/|["']))[^>]*>\s*/gi, '');
  if (!result.includes('id="studio-commercial-fonts"')) {
    result = result.replace('</head>', `  ${LOCAL_INTER_FACE}\n  </head>`);
  }
  const bodyFont = '/assets/fonts/inter-latin-variable.woff2';
  if (!result.includes(`href="${bodyFont}"`)) {
    result = result.replace('</head>', `  <link rel="preload" as="font" type="font/woff2" href="${bodyFont}" crossorigin="anonymous" />\n  </head>`);
  }
  return result.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']image["'])(?=[^>]*\bhref=["']\/assets\/banner\/)[^>]*>\s*/gi, '');
}
