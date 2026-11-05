import { STUDIO_X_FAVICON, STUDIO_X_TOUCH_ICON } from './branding.js';

/** Restore the photography website's icons when leaving product routes. */
export function installStudioProductIcons(document) {
  const previous = [];
  for (const [rel, href, sizes] of [['icon', STUDIO_X_FAVICON, '64x64'], ['apple-touch-icon', STUDIO_X_TOUCH_ICON, '180x180']]) {
    let node = document.querySelector(`link[rel="${rel}"]`);
    const created = !node;
    if (!node) { node = document.createElement('link'); node.setAttribute('rel', rel); document.head.appendChild(node); }
    const attributes = ['href', 'sizes', 'type'].map(name => [name, node.getAttribute(name)]);
    node.setAttribute('href', href); node.setAttribute('sizes', sizes); node.setAttribute('type', 'image/png');
    previous.push(() => { if (created) node.remove(); else for (const [name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); } });
  }
  return () => previous.forEach(restore => restore());
}
