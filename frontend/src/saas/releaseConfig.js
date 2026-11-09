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
  return result.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']image["'])(?=[^>]*\bhref=["']\/assets\/banner\/)[^>]*>\s*/gi, '');
}
