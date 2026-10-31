const colors = { dark: '#131416', light: '#f2f3f0' };

/** Match browser chrome and safe-area canvas to the workspace; restore public-page branding on exit. */
export function installStudioBrowserTheme(document, theme) {
  const color = colors[theme] || colors.light;
  const root = document.documentElement;
  let meta = document.querySelector('meta[name="theme-color"]');
  const created = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  const previous = { color: meta.getAttribute('content'), canvas: root.style.getPropertyValue('--studio-browser-canvas'), scheme: root.style.colorScheme };
  meta.setAttribute('content', color);
  root.style.setProperty('--studio-browser-canvas', color);
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-studio-browser-theme', theme === 'dark' ? 'dark' : 'light');
  return () => {
    if (created) meta.remove();
    else if (previous.color === null) meta.removeAttribute('content');
    else meta.setAttribute('content', previous.color);
    if (previous.canvas) root.style.setProperty('--studio-browser-canvas', previous.canvas);
    else root.style.removeProperty('--studio-browser-canvas');
    root.style.colorScheme = previous.scheme;
    root.removeAttribute('data-studio-browser-theme');
  };
}
