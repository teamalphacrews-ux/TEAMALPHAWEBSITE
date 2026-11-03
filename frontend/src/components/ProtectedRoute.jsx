import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { canAccessStudioPath } from '../utils/moduleAccess';

const ProtectedRoute = ({ allowedRoles }) => {
    const { token, user, loading } = useAuth();
    const location = useLocation();

    if (loading) return null; // Or a spinner

    if (!token || !user) {
        return <Navigate to="/auth" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    if (location.pathname.startsWith('/quote-preview/') && !canAccessStudioPath(user, location.pathname)) return <Navigate to="/admin" replace />;
    return <Outlet />;
};

export default ProtectedRoute;
