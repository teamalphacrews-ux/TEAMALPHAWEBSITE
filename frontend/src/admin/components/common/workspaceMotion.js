import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';

export function workspaceMotionAllowed() {
  return IS_COMMERCIAL_DEPLOYMENT && document.documentElement.dataset.studioMotion !== 'reduced' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
}

