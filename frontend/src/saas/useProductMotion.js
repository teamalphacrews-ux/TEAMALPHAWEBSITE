import { useEffect } from 'react';

const clamp = value => Math.max(0, Math.min(1, value));
const arrive = value => 1 - (1 - clamp(value)) ** 3;
const sceneAttributes = ['data-scroll-scene', 'data-motion-visible', 'data-motion-focus'];
const sceneProperties = ['--scene-progress', '--scene-enter', '--scene-exit'];
const loopSelector = '.pov-warm-light, .pov-camera, .sos-demo-bars, .sos-demo-orbits, .sos-demo-waves, .sos-client-stages';

function remember(node, attributes, properties) {
  return {
    node,
    attributes: attributes.map(name => [name, node.getAttribute(name)]),
    properties: properties.map(name => [name, node.style.getPropertyValue(name)]),
  };
}

function restore({ node, attributes, properties }) {
  attributes.forEach(([name, value]) => {
    if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  });
  properties.forEach(([name, value]) => {
    if (value) node.style.setProperty(name, value);
    else node.style.removeProperty(name);
  });
}

/** Scroll coordinates are written outside React; content is visible without this hook. */
export default function useProductMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const footer = root.querySelector('.sos-footer');
    const scenes = Array.from(root.querySelectorAll('#sos-main > section, .sos-footer, [data-motion-unit]'));
    const snapshots = scenes.map(node => remember(node, sceneAttributes, sceneProperties));
    const rootSnapshot = remember(root, ['data-motion', 'data-motion-paused'], ['--page-progress']);
    const wasReady = root.classList.contains('sos-motion-ready');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hasObserver = typeof IntersectionObserver === 'function';
    const nearby = new Set(scenes);
    const last = new Map();
    const loops = new Map();
    const pendingLoops = new Set();
    let loopObserver = null;
    let loopInventoryDirty = true;
    let frame = 0;
    let measureAll = true;
    let disposed = false;

    const writeProperty = (node, name, value) => {
      const formatted = value.toFixed(4);
      const values = last.get(node) || {};
      if (values[name] === formatted) return;
      node.style.setProperty(name, formatted);
      values[name] = formatted;
      last.set(node, values);
    };

    function syncLoopInventory() {
      if (!loopInventoryDirty) return;
      loopInventoryDirty = false;
      const current = new Set(root.querySelectorAll(loopSelector));
      loops.forEach((record, node) => {
        if (current.has(node)) return;
        loopObserver?.unobserve(node);
        if (node.isConnected) restore(record.snapshot);
        loops.delete(node);
        pendingLoops.delete(node);
      });
      current.forEach(node => {
        if (loops.has(node)) return;
        loops.set(node, { snapshot: remember(node, ['data-motion-loop-visible'], []), visible: !hasObserver });
        pendingLoops.add(node);
        loopObserver?.observe(node);
      });
    }

    function update() {
      frame = 0;
      if (disposed) return;
      syncLoopInventory();

      // Read every required rectangle before changing attributes or styles.
      const viewport = Math.max(1, window.innerHeight);
      const rootRect = root.getBoundingClientRect();
      const focused = document.activeElement;
      const reduced = preference.matches || !hasObserver;
      const targets = measureAll ? scenes : scenes.filter(node => nearby.has(node) || node.contains(focused));
      const measurements = targets.map(node => ({ node, rect: node.getBoundingClientRect(), focused: node.contains(focused) }));
      const pageProgress = clamp(-rootRect.top / Math.max(1, rootRect.height - viewport));
      measureAll = false;

      root.dataset.motion = reduced ? 'reduced' : 'full';
      root.dataset.motionPaused = String(document.hidden);
      writeProperty(root, '--page-progress', pageProgress);
      measurements.forEach(({ node, rect, focused: hasFocus }) => {
        const visible = !hasObserver || (rect.bottom > 0 && rect.top < viewport);
        node.dataset.motionVisible = String(visible);
        node.dataset.motionFocus = String(hasFocus);
        writeProperty(node, '--scene-progress', clamp((viewport - rect.top) / Math.max(1, viewport + rect.height)));
        writeProperty(node, '--scene-enter', reduced || hasFocus ? 1 : arrive((viewport - rect.top) / (viewport * 0.85)));
        writeProperty(node, '--scene-exit', reduced || hasFocus ? 1 : arrive(rect.bottom / (viewport * 0.7)));
      });
      pendingLoops.forEach(node => {
        const record = loops.get(node);
        if (record) node.dataset.motionLoopVisible = String(record.visible);
      });
      pendingLoops.clear();
      root.classList.add('sos-motion-ready');
    }

    function schedule() {
      if (disposed || frame || document.hidden) return;
      frame = window.requestAnimationFrame(update);
    }

    function refresh() {
      measureAll = true;
      schedule();
    }

    function visibilityChanged() {
      if (document.hidden) {
        root.dataset.motionPaused = 'true';
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else refresh();
    }

    scenes.forEach((node, index) => {
      node.dataset.scrollScene = node.dataset.motionUnit || node.id || (node === footer ? 'footer' : `scene-${index + 1}`);
    });

    const observer = hasObserver ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) nearby.add(entry.target);
        else nearby.delete(entry.target);
      });
      // Refresh once for an observer boundary so a departing scene is paused too.
      refresh();
    }, { rootMargin: '20% 0px', threshold: 0 }) : null;
    scenes.forEach(node => observer?.observe(node));

    // A tall section may remain visible long after a small decorative loop has left.
    // Observe those islands independently, with only a small prewarm margin.
    loopObserver = hasObserver ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const record = loops.get(entry.target);
        if (!record) return;
        record.visible = entry.isIntersecting;
        pendingLoops.add(entry.target);
      });
      schedule();
    }, { rootMargin: '64px 0px', threshold: 0 }) : null;

    const mutationObserver = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      // React mounts different loop islands for Finance and Production. Several
      // mutations are collected in the same existing RAF, without style polling.
      loopInventoryDirty = true;
      schedule();
    }) : null;
    mutationObserver?.observe(root, { childList: true, subtree: true });

    // ResizeObserver callbacks share the RAF, including several changes in one turn.
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
    resizeObserver?.observe(root);
    scenes.forEach(node => resizeObserver?.observe(node));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', refresh, { passive: true });
    root.addEventListener('focusin', refresh);
    root.addEventListener('focusout', refresh);
    preference.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', visibilityChanged);

    // A tab restored in the background must also begin in a paused state.
    root.dataset.motionPaused = String(document.hidden);
    update();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      loopObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', refresh);
      root.removeEventListener('focusin', refresh);
      root.removeEventListener('focusout', refresh);
      preference.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', visibilityChanged);
      loops.forEach(({ snapshot }) => { if (snapshot.node.isConnected) restore(snapshot); });
      loops.clear();
      pendingLoops.clear();
      snapshots.forEach(restore);
      restore(rootSnapshot);
      if (!wasReady) root.classList.remove('sos-motion-ready');
    };
  }, [rootRef]);
}
