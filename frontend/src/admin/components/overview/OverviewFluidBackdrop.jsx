import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import useReducedStudioMotion from '../operations/useReducedStudioMotion';

const PAUSE_KEY = 'studio-commercial-overview-fluid-paused';

function readPaused() {
  try { return sessionStorage.getItem(PAUSE_KEY) === 'true'; }
  catch { return false; }
}

export default function OverviewFluidBackdrop() {
  const backdrop = useRef(null);
  const reduced = useReducedStudioMotion();
  const [paused, setPaused] = useState(readPaused);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document !== 'undefined' && !document.hidden);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    let observer;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
      observer.observe(backdrop.current);
    } else {
      setInView(true);
    }
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      observer?.disconnect();
    };
  }, []);

  function toggleMotion() {
    const next = !paused;
    setPaused(next);
    try { sessionStorage.setItem(PAUSE_KEY, String(next)); } catch { /* Storage is optional. */ }
  }

  const moving = !reduced && !paused && inView && pageVisible;
  const label = paused ? 'Resume fluid motion' : 'Pause fluid motion';

  return <>
    <div className="ov-fluid-backdrop" aria-hidden="true" ref={backdrop}>
      <div className="ov-fluid-light" style={{ animationPlayState: moving ? 'running' : 'paused' }} />
    </div>
    {!reduced && <button className="ov-fluid-motion-toggle" type="button" onClick={toggleMotion} aria-label={label} title={label}>
      {paused ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
    </button>}
  </>;
}
