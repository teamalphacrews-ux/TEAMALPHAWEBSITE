const colors = { dark: '#131416', light: '#ffffff', auth: '#ffffff', 'product-auth': '#000000' };
const workspaceColors = { dark: '#111213', light: '#e6e7ea' };

/** Match browser chrome and safe-area canvas to the workspace; restore public-page branding on exit. */
export function installStudioBrowserTheme(document, theme, { commercialWorkspace = false } = {}) {
  const color = commercialWorkspace ? workspaceColors[theme] || workspaceColors.light : colors[theme] || colors.light;
  const root = document.documentElement;
  let meta = document.querySelector('meta[name="theme-color"]');
  const created = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  const viewport = commercialWorkspace || theme === 'product-auth' ? document.querySelector('meta[name="viewport"]') : null;
  const viewportContent = viewport?.getAttribute('content');
  if (viewport && viewportContent != null) {
    const options = viewportContent.split(',').map(option => option.trim()).filter(option => option && !/^viewport-fit\s*=/i.test(option));
    viewport.setAttribute('content', [...options, 'viewport-fit=cover'].join(', '));
  }
  const previous = { color: meta.getAttribute('content'), canvas: root.style.getPropertyValue('--studio-browser-canvas'), scheme: root.style.colorScheme };
  meta.setAttribute('content', color);
  root.style.setProperty('--studio-browser-canvas', color);
  root.style.colorScheme = (theme === 'dark' || theme === 'product-auth') ? 'dark' : 'light';
  root.setAttribute('data-studio-browser-theme', Object.hasOwn(colors, theme) ? theme : 'light');
  return () => {
    if (viewport && viewportContent != null) viewport.setAttribute('content', viewportContent);
    if (created) meta.remove();
    else if (previous.color === null) meta.removeAttribute('content');
    else meta.setAttribute('content', previous.color);
    if (previous.canvas) root.style.setProperty('--studio-browser-canvas', previous.canvas);
    else root.style.removeProperty('--studio-browser-canvas');
    root.style.colorScheme = previous.scheme;
    root.removeAttribute('data-studio-browser-theme');
  };
}
