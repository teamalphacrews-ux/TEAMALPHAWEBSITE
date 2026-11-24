import {
  CLIENT_CAPTURE_VIEWS as views, INITIAL_CAPTURE_ERROR, captureAlt, captureFailure,
  captureLoading, captureMobileHeight, captureStatus, captureView, createCaptureLoader, resolveCaptureImage,
} from './productClientCaptureData.js';
import './productClientCapture.css';

// The homepage already contains the React component's complete static markup.
// Enhance that small island directly; the main app continues to use React.
function enhanceCapture(container) {
  const panel = container.querySelector('#client-capture-panel');
  const tabs = [...container.querySelectorAll('[data-capture-view]')];
  const themes = [...container.querySelectorAll('[data-capture-theme]')];
  const tablist = container.querySelector('[role="tablist"]');
  const status = container.querySelector('.sos-client-capture-status');
  const caption = container.querySelector('.sos-client-capture-caption p');
  const desktopLink = container.querySelector('.sos-client-capture-full.desktop');
  const mobileLink = container.querySelector('.sos-client-capture-full.mobile');
  const loader = createCaptureLoader();
  let selection = { view: 'overview', theme: 'dark' }, requested = selection;
  let loading = '', error = '', disposed = false;

  function showStatus() {
    status.replaceChildren(document.createTextNode(loading || error || captureStatus(selection)));
    panel.setAttribute('aria-busy', String(Boolean(loading)));
    if (!error) return;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.dataset.captureRetry = '';
    retry.append(document.createTextNode('Try again'));
    // RefreshCw geometry from Lucide (ISC); matches the React component's icon.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'lucide lucide-refresh-cw', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
    for (const d of ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5']) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', d); svg.append(path);
    }
    retry.append(svg); status.append(retry);
  }

  function commit(next) {
    const image = resolveCaptureImage(next.view, next.theme);
    // A fresh node also allows a previously broken image to recover on retry.
    const picture = panel.querySelector('picture').cloneNode(true);
    const source = picture.querySelector('source'), img = picture.querySelector('img');
    source.setAttribute('srcset', image.mobile2x);
    source.setAttribute('height', String(captureMobileHeight(next.view)));
    img.setAttribute('srcset', `${image.desktop} 1440w, ${image.desktop2x} 2880w`);
    img.setAttribute('src', image.desktop);
    img.setAttribute('alt', captureAlt(next));
    panel.replaceChildren(picture);
    selection = next;
    for (const tab of tabs) {
      const selected = tab.dataset.captureView === next.view;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
    for (const theme of themes) theme.setAttribute('aria-pressed', String(theme.dataset.captureTheme === next.theme));
    panel.setAttribute('aria-labelledby', `client-capture-tab-${next.view}`);
    caption.firstChild.textContent = captureView(next.view).caption;
    desktopLink.setAttribute('href', image.desktop2x);
    mobileLink.setAttribute('href', image.mobile2x || image.desktop2x);
  }

  async function choose(next, retry = false) {
    if (!retry && next.view === requested.view && next.theme === requested.theme) return;
    requested = next;
    if (retry && document.activeElement === status.querySelector('[data-capture-retry]')) panel.focus({ preventScroll: true });
    loading = captureLoading(next); error = ''; showStatus();
    try {
      if (!await loader.load(next) || disposed) return;
      commit(next); loading = ''; showStatus();
    } catch {
      if (disposed) return;
      loading = ''; error = captureFailure(next); showStatus();
    }
  }

  function click(event) {
    const button = event.target.closest('button');
    if (!button || !container.contains(button)) return;
    if (button.hasAttribute('data-capture-view')) choose({ ...requested, view: button.dataset.captureView });
    else if (button.hasAttribute('data-capture-theme')) choose({ ...requested, theme: button.dataset.captureTheme });
    else if (button.hasAttribute('data-capture-retry')) choose(requested, true);
  }

  function moveTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = views.findIndex(view => view.id === requested.view);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length;
    choose({ ...requested, view: views[next].id }); tabs[next]?.focus();
  }

  function imageError(event) {
    if (event.target.tagName === 'IMG') { error = INITIAL_CAPTURE_ERROR; showStatus(); }
  }
  function pageHide(event) { if (!event.persisted) cleanup(); }
  function cleanup() {
    disposed = true; loader.cancel(); observer.disconnect();
    container.removeEventListener('click', click);
    tablist.removeEventListener('keydown', moveTab);
    panel.removeEventListener('error', imageError, true);
    window.removeEventListener('pagehide', pageHide);
  }
  function watchMount() {
    observer.disconnect();
    for (let ancestor = container.parentNode; ancestor; ancestor = ancestor.parentNode) observer.observe(ancestor, { childList: true });
  }
  const observer = new MutationObserver(() => { if (!container.isConnected) cleanup(); else watchMount(); });
  watchMount();
  container.addEventListener('click', click);
  tablist.addEventListener('keydown', moveTab);
  panel.addEventListener('error', imageError, true);
  window.addEventListener('pagehide', pageHide);
  const initialImage = panel.querySelector('img');
  if (initialImage.complete && initialImage.naturalWidth === 0) imageError({ target: initialImage });
}

const container = document.getElementById('studio-client-capture-root');
if (container) enhanceCapture(container);
