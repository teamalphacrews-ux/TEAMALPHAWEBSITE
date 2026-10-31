import { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { OfflineDraftsProvider } from '../../../offline/OfflineDrafts';
import { NativeDeviceBridge } from '../../../native/NativeDeviceSettings';
import '../../studio.css';
import '../../studio-motion.css';
import '../../studio-mobile.css';
import '../../studio-brand.css';
import { useAuth } from '../../../context/AuthContext';
import useStudioDialog from '../studio/useStudioDialog';
import { StudioPreferencesProvider, useStudioPreferences } from './StudioPreferences';
import '../../studio-appearance.css';
import '../../studio-responsive.css';
import '../../studio-sidebar.css';
import '../../studio-overview-shell.css';
import MobileNavigation from './MobileNavigation';
import useMobileViewport from './useMobileViewport';
import useIPhoneAppNavigation from './useIPhoneAppNavigation';
import IPhoneMoreMenu from './IPhoneMoreMenu';
import '../../studio-phone.css';
import '../../studio-control-polish.css';
import '../../studio-compact-phone.css';
import '../../studio-workflow-upgrade.css';
import '../../studio-phone-refinement.css';
import '../../studio-device-refinement.css';
import '../../studio-drawer-refinement.css';
import '../../studio-iphone-more.css';
import '../../studio-precision-controls.css';
import '../../studio-live-mobile.css';

const StudioControlReview = import.meta.env.DEV ? lazy(() => import('./StudioControlReview')) : null;

function IPhoneNavigation() {
  const [open, setOpen] = useState(false);
  return <div className={'studio-iphone-navigation' + (open ? ' is-more-open' : '')}>
    <MobileNavigation appMenu menuOpen={open} onMenuClick={() => setOpen(true)} controlsId="studio-iphone-more" />
    {open && <IPhoneMoreMenu onClose={() => setOpen(false)} />}
  </div>;
}

function StudioLayout() {
  useMobileViewport();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const location = useLocation();
  const { user, sessionError } = useAuth();
  const iPhoneNavigation = useIPhoneAppNavigation(user);
  const sidebarKey = 'teamalpha-sidebar-compact:' + (user?._id || user?.id || user?.email || 'current');
  const [isSidebarCompact, setIsSidebarCompact] = useState(() => {
    try { return localStorage.getItem(sidebarKey) === 'true'; } catch { return false; }
  });
  const [isDrawerLayout, setIsDrawerLayout] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const { preferences } = useStudioPreferences();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const resize = () => { setIsDrawerLayout(media.matches); setIsSidebarOpen(false); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const toggleSidebar = () => {
    const next = !isSidebarCompact;
    setIsSidebarCompact(next);
    try { localStorage.setItem(sidebarKey, String(next)); } catch { /* Still usable without storage. */ }
  };
  useEffect(() => {
    const previous = document.title;
    document.title = (user?.workspace?.name || 'Team Alpha') + ' — Studio OS';
    return () => { document.title = previous; };
  }, [user?.workspace?.name]);
  const drawerOpen = !iPhoneNavigation && isDrawerLayout && isSidebarOpen;
  const compact = isSidebarCompact && !isDrawerLayout;
  const drawerRef = useStudioDialog(() => setIsSidebarOpen(false), { enabled: drawerOpen });

  return <div data-studio-text-size={preferences.textSize} data-studio-theme={preferences.theme} className={'studio-app studio-personal-workspace' + (iPhoneNavigation ? ' studio-native-phone' : '') + (location.pathname.replace(/\/$/, '') === '/admin' ? ' studio-overview-shell' : '') + (compact ? ' studio-sidebar-compact' : '') + (isFocusMode ? ' studio-focus-mode' : '')}>
    <NativeDeviceBridge />
    <a className="studio-skip-link" href="#studio-main">Skip to content</a>
    {!isFocusMode && !iPhoneNavigation && <>
      {drawerOpen && <button className="studio-sidebar-scrim" data-studio-dismiss-for="studio-navigation-drawer" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} tabIndex={-1} />}
      <div id="studio-navigation-drawer" className={'studio-sidebar-container' + (drawerOpen ? ' is-open' : '')} ref={drawerRef} role={drawerOpen ? "dialog" : undefined} aria-modal={drawerOpen || undefined} aria-label={drawerOpen ? "Studio navigation drawer" : undefined} inert={isDrawerLayout && !drawerOpen} aria-hidden={isDrawerLayout && !drawerOpen ? true : undefined} tabIndex={-1}><Sidebar compact={compact} onToggleCompact={isDrawerLayout ? undefined : toggleSidebar} onClose={() => setIsSidebarOpen(false)} /></div>
    </>}
    {/* The dialog hook owns background isolation, including its cleanup. */}
    <div className="studio-workspace">
      {!isFocusMode && <Topbar onMenuClick={() => setIsSidebarOpen(true)} />}
      {sessionError && <div className="studio-session-warning" role="status"><span>{sessionError}</span><button className="studio-button small" type="button" onClick={() => window.location.reload()}>Retry connection</button></div>}
      <div className="studio-preview-label" hidden={!user?.isPreview}>DESIGN PREVIEW · SAMPLE DATA · Changes in this local preview are temporary.</div>
        <main id="studio-main" className={"studio-main" + (["/admin/users", "/admin/activity-log"].includes(location.pathname) ? " studio-legacy-page" : "")} tabIndex={-1}>
        <Suspense fallback={<div className="studio-loading" role="status"><span className="studio-loader" /> Opening your workspace…</div>}>
          {StudioControlReview && new URLSearchParams(location.search).get('controls') === 'review' ? <StudioControlReview /> : <Outlet context={{ setIsFocusMode }} />}
        </Suspense>
      </main>
      {!isFocusMode && <footer className="studio-footer"><span>{user?.workspace?.name || 'TEAM ALPHA'} <span className="studio-footer-dot">·</span> STUDIO OS</span><span>Made for the stories you create.</span></footer>}
    </div>
    {!isFocusMode && (iPhoneNavigation ? <IPhoneNavigation key={location.key} /> : <MobileNavigation menuOpen={drawerOpen} onMenuClick={() => setIsSidebarOpen(true)} />)}
  </div>;
}
export default function Layout() { return <StudioPreferencesProvider><OfflineDraftsProvider><StudioLayout /></OfflineDraftsProvider></StudioPreferencesProvider>; }
