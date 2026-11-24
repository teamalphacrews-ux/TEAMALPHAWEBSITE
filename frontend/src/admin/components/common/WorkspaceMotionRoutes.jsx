import { useLayoutEffect, useState } from 'react';
import { Routes } from 'react-router-dom';
import { leaveWorkspacePage, motionAllowed, routeDirection } from './workspaceRouteMotion';

// Hold just the outgoing workspace route during its short exit. The route subtree
// receives its own location from Routes. Auth changes, editors and query updates are immediate.
const adminPath = path => path === '/admin' || path.startsWith('/admin/');

export default function WorkspaceMotionRoutes({ location, owner, children }) {
  const [painted, setPainted] = useState(() => ({location, owner}));
  const current = location.pathname.replace(/\/$/, '');
  const previous = painted.location.pathname.replace(/\/$/, '');
  const betweenPages = owner && owner === painted.owner && current !== previous &&
    adminPath(previous) && adminPath(current);

  useLayoutEffect(() => {
    if (painted.location === location && painted.owner === owner) return;
    const commit = () => setPainted({location, owner});
    const main = document.getElementById('studio-main');
    if (betweenPages && main?.firstElementChild && motionAllowed() && !main.closest('.studio-focus-mode') &&
      !document.querySelector('[aria-modal="true"]:not([hidden])')) {
      return leaveWorkspacePage(main, routeDirection(previous, current), commit);
    }
    commit();
  }, [location, owner, painted, betweenPages, previous, current]);

  return <Routes location={betweenPages ? painted.location : location}>{children}</Routes>;
}
