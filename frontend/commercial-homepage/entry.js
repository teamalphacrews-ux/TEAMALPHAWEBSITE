const assets = document.getElementById('studio-app-assets');
const path = location.pathname.replace(/\/+$/, '').toLowerCase();
const isHome = path === '' || path === '/studio-os' || path === '/index.html';

function runScript(source) {
  const script = document.createElement('script');
  for (const { name, value } of source.attributes) script.setAttribute(name, value);
  script.textContent = source.textContent;
  document.body.append(script);
}

async function openApp() {
  const styles = [];
  for (const source of assets.content.querySelectorAll('link')) {
    const link = source.cloneNode();
    if (link.rel === 'stylesheet') styles.push(new Promise(resolve => {
      link.onload = link.onerror = resolve;
    }));
    document.head.append(link);
  }
  await Promise.all(styles);
  for (const source of assets.content.querySelectorAll('script')) runScript(source);
  assets.remove();
}

async function openHome() {
  // The build fingerprints and serves this trusted document on the same origin.
  const response = await fetch(assets.dataset.home, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Homepage unavailable');
  const page = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!page.querySelector('.sos-scene-reference')) throw new Error('Homepage unavailable');
  const scripts = [...page.querySelectorAll('script:not([type="application/json"])')];
  for (const script of scripts) script.remove();
  document.documentElement.replaceChildren(document.adoptNode(page.head), document.adoptNode(page.body));
  for (const script of scripts) runScript(script);
  // Fragment links can arrive before the requested section exists in the DOM.
  if (location.hash.length > 1) {
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* A literal fragment is also valid. */ }
    document.getElementById(id)?.scrollIntoView();
  }
}

if (isHome) {
  openHome().catch(() => {
    // A failed shell fetch can still be retried through a normal document request.
    const retry = document.createElement('a');
    retry.href = location.href;
    retry.textContent = 'Reload the Studio X OS homepage';
    document.getElementById('root')?.replaceChildren(retry);
  });
} else {
  openApp();
}
