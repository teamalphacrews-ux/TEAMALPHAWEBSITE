import { workspaceMotionAllowed } from './workspaceMotion';

// Animate the live page. App navigation and persistence remain owned by the router.
const panels = [
  '.studio-card', '.studio-metric', '.reference-section', '.ops-card', '.settings-pref-section',
  '.settings-group', '.settings-main-panel', '.studio-integration-card', '.account-flow-card',
  '.qw-list-table', '.workspace-team-card', '.support-inbox', '.support-conversation',
  '.sx-desk-card', '.sx-desk-account', '.record-project-tile', '.record-person', '.sx-task-lane',
].join(',');
const headings = '.studio-page-heading, .reference-heading, .settings-page-title, .sx-desk-header, .record-views, .reference-tabs, .studio-page-tabs';
const expoOut = 'cubic-bezier(.16,1,.3,1)';
const powerIn = 'cubic-bezier(.55,.055,.675,.19)';

export const motionAllowed = () => !document.hidden && workspaceMotionAllowed();

export function routeDirection(from, to) {
  const nav = document.querySelector('#studio-navigation-drawer') || document.querySelector('.studio-mobile-navigation');
  const paths = [...(nav?.querySelectorAll('a[href]') || [])].map(link => link.pathname.replace(/\/$/, ''));
  const index = path => paths.indexOf('/' + path.split('/').filter(Boolean).slice(0, 2).join('/'));
  const a = index(from), b = index(to);
  if (a >= 0 && b >= 0 && a !== b) return b > a ? 1 : -1;
  if (a === -1 && b >= 0) return -1;
  return from.startsWith(to + '/') ? -1 : 1;
}

// Stop active WAAPI effects as soon as either motion preference changes.
function watchMotion(stop) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const check = () => { if (!motionAllowed()) stop(); };
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-studio-motion'] });
  media.addEventListener('change', check);
  document.addEventListener('visibilitychange', check);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', check);
    document.removeEventListener('visibilitychange', check);
  };
}

function visiblePanels(root) {
  const limit = window.innerHeight + 40;
  return [...root.querySelectorAll(panels)].filter(node => {
    if (node.parentElement?.closest(panels)) return false;
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < limit;
  }).slice(0, 12);
}

function play(node, id, frames, timing) {
  const animation = node.animate(frames, timing);
  animation.id = 'studio-route-' + id;
  return animation;
}

export function leaveWorkspacePage(main, direction, commit) {
  const page = main.firstElementChild;
  const animations = [];
  let done = false;
  let timer;
  let unwatch = () => {};
  const wasInert = main.inert;
  function clear() {
    clearTimeout(timer);
    unwatch();
    main.inert = wasInert;
    for (const animation of animations) animation.cancel();
  }
  function finish() {
    if (done) return;
    done = true;
    clear();
    commit();
  }
  main.inert = true;
  const timing = { duration: 180, easing: powerIn, fill: 'forwards' };
  try {
    animations.push(play(page, 'leave', [{translate:'0px'}, {translate:(-16 * direction) + 'px'}], timing));
    for (const header of page.querySelectorAll(headings)) {
      animations.push(play(header, 'heading-leave', [{opacity:1,translate:'0 0'}, {opacity:0,translate:'0 -6px'}], {...timing, duration:144}));
    }
    visiblePanels(page).forEach((card, i) => {
      animations.push(play(card, 'card-leave', [{opacity:1,translate:'0 0',scale:1}, {opacity:0,translate:'0 8px',scale:.985}], {...timing, delay:8*i}));
    });
    unwatch = watchMotion(finish);
    // Navigation must also complete if an element disappears during its animation.
    timer = setTimeout(finish, 185);
  } catch { finish(); }
  return () => { if (!done) { done = true; clear(); } };
}

export function enterWorkspacePage(main, direction) {
  if (!motionAllowed()) return;
  const animated = new Set();
  const animations = [];
  let page, observer, unwatch, timeout;
  function stop() {
    clearTimeout(timeout);
    observer?.disconnect();
    unwatch?.();
    for (const animation of animations) animation.cancel();
  }
  function reveal() {
    // Menus and modal editors keep their viewport positioning and focus ownership.
    if (document.querySelector('[aria-modal="true"]:not([hidden])') || main.closest('.studio-focus-mode')) { stop(); return; }
    const next = [...main.children].find(node => !node.matches('.studio-loading, [hidden]') && node.getClientRects().length);
    if (!next) return;
    try {
      if (page !== next) {
        page = next;
        // Start the collection window when content lands, even on a slow connection.
        clearTimeout(timeout);
        timeout = setTimeout(() => observer.disconnect(), 1800);
        animations.push(play(page, 'enter', [
          {translate: direction ? (direction * 26) + 'px 0' : '0 30px'}, {translate:'0px 0px'},
        ], {duration:direction ? 700 : 1000, easing:expoOut}));
      }
      // Overview and the record views own their card sequences, including data that arrives later.
      if (page.matches('.sx-studio-desk,.record-desk,.sx-task-page') || page.querySelector('.sx-studio-desk,.record-desk,.sx-task-page')) return;
      const arriving = visiblePanels(page).filter(node => !animated.has(node));
      arriving.forEach((card, i) => {
        animated.add(card);
        animations.push(play(card, 'card-enter', [{opacity:0,translate:'0 26px',scale:.985}, {opacity:1,translate:'0 0',scale:1}],
          {duration:800, delay:i*55, easing:expoOut, fill:'backwards'}));
      });
    } catch { stop(); }
  }
  // Routes and data-backed cards can finish mounting after the Suspense fallback.
  observer = new MutationObserver(reveal);
  observer.observe(main, { childList:true, subtree:true });
  unwatch = watchMotion(stop);
  reveal();
  return stop;
}

const primaryActions = ':is(.sx-desk-new,.reference-button,.studio-button.primary,.qw-primary,.invoice-primary,[data-variant="primary"]):not(:disabled,[aria-disabled="true"],.danger,.secondary,.ghost)';

export function followPrimaryAction(main) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let active, bounds;
  function reset() {
    if (!active) return;
    active.style.removeProperty('--action-x');
    active.style.removeProperty('--action-y');
    active.removeAttribute('data-studio-follow');
    active = null;
  }
  function track(event) {
    const target = event.target.closest?.(primaryActions);
    if (!target || event.pointerType !== 'mouse' || !finePointer.matches || !motionAllowed()) { reset(); return; }
    if (active !== target) {
      reset();
      active = target;
      bounds = target.getBoundingClientRect();
      active.setAttribute('data-studio-follow', '');
    }
    const clamp = distance => Math.max(-6, Math.min(6, distance * .17)) + 'px';
    active.style.setProperty('--action-x', clamp(event.clientX - bounds.left - bounds.width / 2));
    active.style.setProperty('--action-y', clamp(event.clientY - bounds.top - bounds.height / 2));
  }
  const leave = event => { if (active && !active.contains(event.relatedTarget)) reset(); };
  main.addEventListener('pointermove', track, { passive:true });
  main.addEventListener('pointerout', leave);
  window.addEventListener('scroll', reset, {capture:true, passive:true});
  const unwatch = watchMotion(reset);
  return () => {
    reset();
    unwatch();
    main.removeEventListener('pointermove', track);
    main.removeEventListener('pointerout', leave);
    window.removeEventListener('scroll', reset, true);
  };
}
