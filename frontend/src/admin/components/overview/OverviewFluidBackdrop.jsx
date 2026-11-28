import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import useReducedStudioMotion from '../operations/useReducedStudioMotion';

const PAUSE_KEY = 'studio-commercial-overview-fluid-paused';

function readPaused() {
  try { return sessionStorage.getItem(PAUSE_KEY) === 'true'; }
  catch { return false; }
}

function subscribeToVisibility(callback) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

const documentIsVisible = () => !document.hidden;
const serverDocumentIsVisible = () => false;

export default function OverviewFluidBackdrop() {
  const backdrop = useRef(null);
  const reduced = useReducedStudioMotion();
  const [paused, setPaused] = useState(readPaused);
  const [inView, setInView] = useState(() => typeof IntersectionObserver !== 'function');
  const pageVisible = useSyncExternalStore(subscribeToVisibility, documentIsVisible, serverDocumentIsVisible);

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(backdrop.current);
    return () => observer.disconnect();
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
