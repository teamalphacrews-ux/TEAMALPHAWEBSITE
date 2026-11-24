import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Moon, RefreshCw, Sun } from 'lucide-react';
import {
  CLIENT_CAPTURE_VIEWS as views, INITIAL_CAPTURE_ERROR, captureAlt, captureFailure,
  captureLoading, captureMobileHeight, captureStatus, captureView, createCaptureLoader, resolveCaptureImage,
} from './productClientCaptureData.js';
import './productClientCapture.css';

/** Photographs of the actual sample client UI; no account, payment or message action. */
export default function ProductClientCapture() {
  const [selection, setSelection] = useState({ view: 'overview', theme: 'dark' });
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [imageRevision, setImageRevision] = useState(0);
  const requested = useRef(selection), loader = useRef(null);
  if (loader.current === null) { loader.current = createCaptureLoader(); }
  const retryButton = useRef(null), panel = useRef(null);
  const currentView = captureView(selection.view);
  const image = resolveCaptureImage(selection.view, selection.theme);
  const mobileHeight = captureMobileHeight(selection.view);

  useEffect(() => {
    const currentLoader = loader.current;
    return () => currentLoader.cancel();
  }, []);

  async function choose(next, retry = false) {
    if (!retry && next.view === requested.current.view && next.theme === requested.current.theme) return;
    requested.current = next;
    if (retry && document.activeElement === retryButton.current) panel.current?.focus({ preventScroll: true });
    setLoading(captureLoading(next));
    setError('');
    try {
      if (!await loader.current.load(next)) return;
      if (retry) setImageRevision(value => value + 1);
      setSelection(next); setLoading('');
    } catch {
      setLoading(''); setError(captureFailure(next));
    }
  }

  function moveTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = views.findIndex(view => view.id === requested.current.view);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length;
    choose({ ...requested.current, view: views[next].id });
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return <div className="sos-client-capture" data-motion-unit="client-preview">
    <div className="sos-client-capture-heading"><strong>Client Smart Link</strong><div role="group" aria-label="Client preview appearance">{['light', 'dark'].map(theme => <button key={theme} type="button" data-capture-theme={theme} aria-pressed={selection.theme === theme} onClick={() => choose({ ...requested.current, theme })}>{theme === 'dark' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}{theme === 'dark' ? 'Dark' : 'Day'}</button>)}</div></div>
    <div className="sos-client-capture-tabs" role="tablist" aria-label="Current client product screens" onKeyDown={moveTab}>{views.map(view => <button key={view.id} type="button" data-capture-view={view.id} role="tab" id={'client-capture-tab-' + view.id} aria-selected={selection.view === view.id} tabIndex={selection.view === view.id ? 0 : -1} aria-controls="client-capture-panel" onClick={() => choose({ ...requested.current, view: view.id })}>{view.label}</button>)}</div>
    <p className="sos-client-capture-status" role="status" aria-live="polite">{loading || error || captureStatus(selection)}{error && <button ref={retryButton} type="button" data-capture-retry="" onClick={() => choose(requested.current, true)}>Try again<RefreshCw size={14} aria-hidden="true" /></button>}</p>
    <p className="sos-client-capture-scroll-help" id="client-capture-scroll-help">Scroll inside the image for the full view.</p>
    <div ref={panel} id="client-capture-panel" className="sos-client-capture-panel" role="tabpanel" tabIndex={0} aria-labelledby={'client-capture-tab-' + selection.view} aria-describedby="client-capture-scroll-help" aria-busy={Boolean(loading)}>
      <picture key={selection.view + '-' + selection.theme + '-' + imageRevision}>{image.mobile2x && <source media="(max-width: 600px)" srcSet={image.mobile2x} width="390" height={mobileHeight} />}<img src={image.desktop} srcSet={`${image.desktop} 1440w, ${image.desktop2x} 2880w`} sizes="(max-width: 850px) calc(100vw - 40px), 760px" width="1440" height="960" loading="lazy" decoding="async" alt={captureAlt(selection)} onError={() => setError(INITIAL_CAPTURE_ERROR)} /></picture>
    </div>
    <div className="sos-client-capture-caption"><p>{currentView.caption}<span>Product screen capture · Fictional sample studio</span></p><a className="sos-client-capture-full desktop" href={image.desktop2x} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={15} aria-hidden="true" /></a><a className="sos-client-capture-full mobile" href={image.mobile2x || image.desktop2x} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={15} aria-hidden="true" /></a></div>
    <a className="sos-client-capture-guide" href="/studio-os/docs/client-guide"><BookOpen size={17} aria-hidden="true" />Read the client guide<ArrowUpRight size={15} aria-hidden="true" /></a>
  </div>;
}
