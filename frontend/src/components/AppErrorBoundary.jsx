import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RouteErrorBoundary from './RouteErrorBoundary';
import { installStudioBrowserTheme } from '../utils/studioBrowserTheme';
import './appErrorBoundary.css';

function RecoveryPage({ onRetry, appearance }) {
  const titleRef = useRef(null);
  useLayoutEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    return installStudioBrowserTheme(document, appearance);
  }, [appearance]);

  return (
    <main className="studio-recovery" data-recovery-appearance={appearance}>
      <section className="studio-recovery-card" aria-labelledby="studio-recovery-title">
        <span className="studio-recovery-symbol" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7v5h-5" /><path d="M19.1 15.5a8 8 0 1 1 .2-7.3L20 12" />
          </svg>
        </span>
        <p className="studio-recovery-eyebrow">Studio OS</p>
        <h1 id="studio-recovery-title" ref={titleRef} tabIndex={-1}>This page couldn’t open.</h1>
        <p role="alert">Try again to reopen this page. If the problem continues, reload the website.</p>
        <div className="studio-recovery-actions">
          <button type="button" onClick={onRetry} className="studio-recovery-primary">Try again</button>
          <Link to="/">View home</Link>
          <button type="button" onClick={() => window.location.reload()}>Reload website</button>
        </div>
        <p className="studio-recovery-note">Unsaved edits may need to be entered again.</p>
      </section>
    </main>
  );
}

export default function AppErrorBoundary({ children }) {
  const location = useLocation();
  const resetKey = location.pathname + location.search;
  return <RouteErrorBoundary resetKey={resetKey} fallback={RecoveryPage}>{children}</RouteErrorBoundary>;
}
