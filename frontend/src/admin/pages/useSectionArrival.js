import { useLayoutEffect, useRef } from 'react';
import { IS_COMMERCIAL_DEPLOYMENT } from '../../saas/release';
import useReducedStudioMotion from '../components/operations/useReducedStudioMotion';

// Animate the committed section in place. Inputs, validation and router state stay live.
export function useSectionArrival(container, position, selector) {
  const previous = useRef(position);
  const reduced = useReducedStudioMotion();
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = position;
    if (from === position || !IS_COMMERCIAL_DEPLOYMENT || reduced || document.hidden) return;
    const panel = container.current?.querySelector(selector);
    if (!panel?.animate) return;
    const animation = panel.animate([
      { opacity: .3, translate: (position > from ? 14 : -14) + 'px 0' },
      { opacity: 1, translate: '0 0' },
    ], { id: 'studio-section-enter', duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
    return () => animation.cancel();
  }, [container, position, reduced, selector]);
}
