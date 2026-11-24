export function recordMotionAllowed() {
  return document.documentElement.dataset.studioMotion !== 'reduced'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Positions are relative to the scrolling container so a scroll between the response
// and React commit never looks like a card move.
export function recordPositions(container) {
  const positions = new Map();
  if (!container) return positions;
  const bounds = container.getBoundingClientRect();
  for (const item of container.querySelectorAll('[data-record-key]')) {
    const rect = item.getBoundingClientRect();
    positions.set(item.dataset.recordKey, { x: rect.left - bounds.left + container.scrollLeft, y: rect.top - bounds.top + container.scrollTop });
  }
  return positions;
}

export function settleRecordPositions(container, before) {
  if (!container || !before.size || !recordMotionAllowed()) return;
  const after = recordPositions(container);
  for (const card of container.querySelectorAll('[data-record-key]')) {
    const key = card.dataset.recordKey;
    if (!before.has(key)) continue;
    const dx = before.get(key).x - after.get(key).x;
    const dy = before.get(key).y - after.get(key).y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    card.getAnimations().filter(animation => animation.id === 'studio-record-move' || animation.animationName === 'record-task-enter').forEach(animation => animation.cancel());
    card.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0 0' }], {
      id: 'studio-record-move', duration: 550, easing: 'cubic-bezier(.16, 1, .3, 1)',
    });
  }
}
