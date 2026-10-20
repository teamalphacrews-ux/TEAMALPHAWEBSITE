import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import '../../studio.css';
import '../../studio-mobile.css';
import { useAuth } from '../../../context/AuthContext';
import useStudioDialog from '../studio/useStudioDialog';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    const previous = document.title;
    document.title = 'Team Alpha — Studio OS';
    return () => { document.title = previous; };
  }, []);
  const drawerRef = useStudioDialog(() => setIsSidebarOpen(false), { enabled: isSidebarOpen });

  return <div className={'studio-app' + (isFocusMode ? ' studio-focus-mode' : '')}>
    <a className="studio-skip-link" href="#studio-main">Skip to content</a>
    {!isFocusMode && <>
      {isSidebarOpen && <button className="studio-sidebar-scrim" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />}
      <div className={'studio-sidebar-container' + (isSidebarOpen ? ' is-open' : '')} ref={drawerRef} role={isSidebarOpen ? "dialog" : undefined} aria-modal={isSidebarOpen || undefined} aria-label={isSidebarOpen ? "Studio navigation drawer" : undefined} tabIndex={-1}><Sidebar onClose={() => setIsSidebarOpen(false)} /></div>
    </>}
    <div className="studio-workspace">
      {!isFocusMode && <Topbar onMenuClick={() => setIsSidebarOpen(true)} />}
      <div className="studio-preview-label" hidden={!user?.isPreview}>DESIGN PREVIEW · SAMPLE DATA · Changes in this local preview are temporary.</div>
        <main id="studio-main" className={"studio-main" + (["/admin/users", "/admin/activity-log", "/admin/chats"].includes(location.pathname) ? " studio-legacy-page" : "")} key={location.pathname} tabIndex={-1}>
        <Suspense fallback={<div className="studio-loading" role="status"><span className="studio-loader" /> Opening your workspace…</div>}>
          <Outlet context={{ setIsFocusMode }} />
        </Suspense>
      </main>
      {!isFocusMode && <footer className="studio-footer"><span>TEAM ALPHA <span className="studio-footer-dot">·</span> STUDIO OS</span><span>Made for the stories you create.</span></footer>}
    </div>
  </div>;
}
