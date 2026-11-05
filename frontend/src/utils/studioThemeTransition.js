// A visual enhancement only: changing the saved theme never depends on animation support.
const activeTransitions = new WeakMap();
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
export function themeRevealGeometry(origin, { width, height }) {
  width = Math.max(1, finite(width, 1)); height = Math.max(1, finite(height, 1));
  const rect = origin?.getBoundingClientRect?.();
  const point = rect && rect.width > 0 && rect.height > 0
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : origin;
  const x = Math.max(0, Math.min(width, finite(point?.x, width / 2)));
  const y = Math.max(0, Math.min(height, finite(point?.y, height / 2)));
  return { x, y, radius: Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y))) + 2 };
}
export function cancelStudioThemeTransition(doc = document) {
  const active = activeTransitions.get(doc);
  if (active) { active.cancelled = true; active.finish(); }
}
const targets = [
  '.studio-brand', '.saas-switcher-trigger', '.studio-nav-item', '.studio-nav-group-toggle', '.studio-sidebar-footer',
  '.studio-topbar-context', '.studio-topbar-actions > button', '.studio-global-search', '.studio-notification-wrap',
  '.studio-overview-header > div', '.overview-section-heading', '.overview-feature-card', '.studio-metric',
  '.studio-card', '.overview-quick-wrapper', '.studio-main h1', '.workspace-page-header', '.workspace-toolbar',
  '.settings-navigation', '.settings-section-heading', '.settings-pref-section', '.settings-pref-status',
  '.reference-detail-card', '.reference-project-card', '.studio-crm-project-card', '.studio-modal-header',
  '.studio-modal-footer', '.studio-team-dialog-header', '.qw-paper', '.qw-settings', '.qw-list-table',
  '.invoice-editor-toolbar', '.invoice-editor-settings', '.invoice-editor-content', '.saas-summary-card',
].join(',');
function visibleElements(doc, width, height) {
  const candidates = [...(doc.querySelectorAll?.(targets) || [])], selected = new Set(candidates);
  return candidates.filter(element => {
    if (element.closest?.('[aria-hidden="true"], [inert]')) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (selected.has(parent)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top < height && rect.bottom > 0 && rect.left < width && rect.right > 0;
  }).slice(0, 90);
}
export function transitionStudioTheme({ commit, origin, reduceMotion = false, doc = document, win = window }) {
  cancelStudioThemeTransition(doc);
  const root = doc.documentElement;
  let resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const request = { cancelled: false, committed: false, timer: null, animations: [], targets: [], ripple: null };
  activeTransitions.set(doc, request);
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const apply = () => { if (!request.cancelled && !request.committed) { request.committed = true; commit(); } };
  const finishNow = () => { apply(); cancelStudioThemeTransition(doc); };
  request.finish = () => {
    if (request.finished) return;
    request.finished = true;
    win.clearTimeout(request.timer);
    for (const animation of request.animations) { try { animation.cancel(); } catch { /* Already released. */ } }
    for (const { element, delay } of request.targets) {
      if (delay) element.style.setProperty('--studio-theme-delay', delay); else element.style.removeProperty('--studio-theme-delay');
    }
    request.ripple?.remove();
    media?.removeEventListener?.('change', onMotionChange);
    win.removeEventListener?.('resize', finishNow);
    doc.removeEventListener?.('visibilitychange', onVisibilityChange);
    if (activeTransitions.get(doc) === request) { root.classList.remove('studio-theme-fade'); activeTransitions.delete(doc); }
    resolveFinished();
  };
  function onMotionChange(event) { if (event.matches) finishNow(); }
  function onVisibilityChange() { if (doc.visibilityState === 'hidden') finishNow(); }
  if (reduceMotion || media?.matches || doc.visibilityState === 'hidden') { apply(); request.finish(); return finished; }
  media?.addEventListener?.('change', onMotionChange);
  win.addEventListener?.('resize', finishNow, { once: true });
  doc.addEventListener?.('visibilitychange', onVisibilityChange);
  const width = win.innerWidth, height = win.innerHeight;
  const { x, y, radius } = themeRevealGeometry(origin, { width, height });
  const duration = width < 700 ? 500 : 620;
  const wave = visibleElements(doc, width, height).map(element => {
    const rect = element.getBoundingClientRect();
    const distance = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    const delay = Math.round(Math.min(1, distance / radius) * 180);
    request.targets.push({ element, delay: element.style.getPropertyValue('--studio-theme-delay') });
    element.style.setProperty('--studio-theme-delay', delay + 'ms');
    return { element, delay };
  });
  root.classList.add('studio-theme-fade');
  if (doc.createElement && doc.body?.appendChild) {
    const overlay = doc.createElement('div'), disc = doc.createElement('div');
    overlay.className = 'studio-theme-ripple'; overlay.setAttribute('aria-hidden', 'true');
    disc.className = 'studio-theme-ripple-disc';
    disc.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + radius * 2 + 'px;height:' + radius * 2 + 'px;animation-duration:' + (duration + 180) + 'ms';
    overlay.appendChild(disc); doc.body.appendChild(overlay); request.ripple = overlay;
  }
  root.getBoundingClientRect?.();
  apply();
  for (const { element, delay } of wave) {
    if (typeof element.animate !== 'function') continue;
    const baseline = win.getComputedStyle?.(element)?.translate || 'none';
    const parts = baseline === 'none' ? ['0px', '0px'] : baseline.split(/\s+/);
    const lift = width < 700 ? 6 : 9;
    try {
      const animation = element.animate([
        { translate: baseline, offset: 0 },
        { translate: parts[0] + ' calc(' + (parts[1] || '0px') + ' - ' + lift + 'px)' + (parts[2] ? ' ' + parts[2] : ''), offset: .38 },
        { translate: baseline, offset: 1 },
      ], { duration, delay, easing: 'cubic-bezier(.25,.75,.3,1)' });
      request.animations.push(animation); animation.finished?.catch(() => {});
    } catch { /* Color transitions and ripple remain available in older browsers. */ }
  }
  request.timer = win.setTimeout(request.finish, duration + 240);
  return finished;
}
