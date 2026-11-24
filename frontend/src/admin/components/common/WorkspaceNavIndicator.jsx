import { useLayoutEffect, useRef } from 'react';

export default function WorkspaceNavIndicator({ navRef, selection }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ink = ref.current;
    const nav = navRef.current || ink?.parentElement;
    if (!nav || !ink) return;
    const render = (animate = false) => {
      const link = nav.querySelector('[aria-current="page"],.has-current');
      if (!link?.offsetHeight || !nav.clientWidth) { ink.hidden = true; return; }
      const top = link.offsetTop;
      const previous = Number(ink.dataset.top);
      const mayTravel = animate && !ink.hidden && previous !== top;
      ink.dataset.travel = mayTravel ? (top > previous ? 'down' : 'up') : 'none';
      ink.style.top = top + 'px';
      ink.style.bottom = 'calc(100% - ' + (top + link.offsetHeight) + 'px)';
      ink.dataset.top = String(top);
      ink.hidden = false;
    };
    render(true);
    let first = true;
    const observer = new ResizeObserver(() => { if (first) first = false; else render(); });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [navRef, selection]);
  return <span ref={ref} className="sx-desk-nav-indicator" hidden aria-hidden="true" />;
}
