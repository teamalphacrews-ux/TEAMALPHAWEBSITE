import { useEffect, useLayoutEffect, useRef } from 'react';
import { workspaceMotionAllowed } from './workspaceMotion';

const expoOut = 'cubic-bezier(.16,1,.3,1)';
const mask = width => `inset(0px ${Math.max(0, width)}px 0px 0px)`;

// Capture content position before the compact layout reflows. The rail closes
// first; on expansion the content and the uncover run together.
export function useWorkspaceRailMotion(compact, toggle) {
  const railRef = useRef(null);
  const motion = useRef({ pendingCollapse: false, previousLeft: null, players: [] });
  const clear = () => { motion.current.players.splice(0).forEach(player => player.cancel()); };
  useEffect(() => {
    const state = motion.current;
    return () => { state.players.forEach(player => player.cancel()); };
  }, []);
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || !workspaceMotionAllowed() || !window.matchMedia('(min-width:1101px)').matches) return;
    const players = [];
    const arrival = (elements, duration, delay, stagger, x, easing) => elements.forEach((element, index) => {
      if (element.offsetHeight) players.push(element.animate([{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: 'none' }],
        { duration, delay: delay + index * stagger, easing, fill: 'backwards' }));
    });
    arrival(rail.querySelectorAll('.sx-desk-nav-panel,.sx-desk-account-panel'), 900, 0, 80, -60, expoOut);
    arrival(rail.querySelectorAll('.sx-desk-brand-row,.sx-desk-nav-group h2,.studio-nav-item'), 500, 150, 25, -12, 'cubic-bezier(.22,1,.36,1)');
    const ink = rail.querySelector('.sx-desk-nav-indicator');
    if (ink) players.push(ink.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1)' }],
      { duration: 600, delay: 500, easing: 'cubic-bezier(.34,1.72,.64,1)', fill: 'backwards' }));
    return () => players.forEach(player => player.cancel());
  }, []);
  useLayoutEffect(() => {
    const state = motion.current;
    if (state.previousLeft === null) return;
    const shell = railRef.current?.closest('#sx-workspace-shell');
    const content = shell?.querySelector('.studio-workspace');
    clear();
    const left = state.previousLeft;
    state.previousLeft = null;
    state.pendingCollapse = false;
    if (!content || !workspaceMotionAllowed()) return;
    const delta = left - content.getBoundingClientRect().left;
    if (!delta) return;
    state.players.push(content.animate([{ transform: `translateX(${delta}px)` }, { transform: 'none' }], { duration: 600, easing: expoOut }));
    if (!compact) {
      state.players.push(railRef.current.animate([{ clipPath: mask(-delta) }, { clipPath: mask(0) }], { duration: 500, easing: expoOut }));
      const labels = railRef.current.querySelectorAll('.sx-desk-brand-name,.sx-desk-nav-group h2,.studio-nav-text,.sx-desk-preview-note');
      labels.forEach((label, index) => {
        if (label.getClientRects().length) state.players.push(label.animate([
          { opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' },
        ], { duration: 550, delay: 80 + index * 15, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      });
    }
  }, [compact]);
  function toggleRail() {
    if (!toggle) return;
    const state = motion.current;
    const shell = railRef.current?.closest('#sx-workspace-shell');
    const content = shell?.querySelector('.studio-workspace');
    if (state.pendingCollapse) {
      state.pendingCollapse = false;
      state.previousLeft = null;
      clear();
      return;
    }
    if (!content || !workspaceMotionAllowed()) { toggle(); return; }
    state.previousLeft = content.getBoundingClientRect().left;
    clear();
    if (compact) { toggle(); return; }
    const compactWidth = parseFloat(getComputedStyle(shell).getPropertyValue('--desk-compact-width'));
    const amount = content.getBoundingClientRect().left - compactWidth;
    const wipe = railRef.current.animate([{ clipPath: mask(0) }, { clipPath: mask(amount) }],
      { duration: 320, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    state.pendingCollapse = true;
    state.players.push(wipe);
    wipe.onfinish = () => { if (state.pendingCollapse && railRef.current?.isConnected) toggle(); };
  }
  return { railRef, toggleRail };
}
