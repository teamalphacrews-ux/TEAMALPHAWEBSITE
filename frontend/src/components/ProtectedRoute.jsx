import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { canAccessStudioPath } from '../utils/moduleAccess';
import { SAAS_RELEASE_ENABLED } from '../saas/release';
import { STUDIO_SETUP_PATH, requiresStudioSetup } from '../saas/studioSetupAccess';

const ProtectedRoute = ({ allowedRoles }) => {
    const { token, user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return requiresStudioSetup(user)
            ? <div className="studio-product-loading" role="status">Opening your studio setup…</div>
            : null;
    }

    if (!token || !user) {
        return <Navigate to="/auth" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    if (SAAS_RELEASE_ENABLED && requiresStudioSetup(user) && location.pathname.replace(/\/$/, '') !== STUDIO_SETUP_PATH) {
        return <Navigate to={STUDIO_SETUP_PATH} state={{ returnTo: location.pathname + location.search + location.hash }} replace />;
    }

    if (location.pathname.startsWith('/quote-preview/') && !canAccessStudioPath(user, location.pathname)) return <Navigate to="/admin" replace />;
    return <Outlet />;
};

export default ProtectedRoute;
