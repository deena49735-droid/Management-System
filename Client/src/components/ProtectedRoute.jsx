import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, Home, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

/**
 * Helper to get default dashboard path by role
 */
export const getDashboardPathByRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'teamHead':
      return '/head';
    case 'teamAssistant':
      return '/assistant';
    case 'member':
    default:
      return '/dashboard';
  }
};

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  // 1. Show loading spinner while checking and restoring authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading Kadambas Game...</p>
        </div>
      </div>
    );
  }

  // 2. Only redirect to /login when loading is false AND there is no user
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role restriction check: If role is not permitted, show Access Denied screen
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    const homePath = getDashboardPathByRole(user.role);

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xs border border-slate-200 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4 border border-rose-100">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Access denied</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            You do not have permission to view this page.
          </p>
          <div className="mt-4 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 text-left border border-slate-100 space-y-1">
            <p><span className="font-semibold text-slate-700">Your role:</span> {user.role === 'teamHead' ? 'Team Head' : user.role === 'teamAssistant' ? 'Team Assistant' : user.role}</p>
            <p><span className="font-semibold text-slate-700">Required role(s):</span> {roles.map(r => r === 'teamHead' ? 'Team Head' : r === 'teamAssistant' ? 'Team Assistant' : r).join(', ')}</p>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link to={homePath} className="flex-1">
              <Button variant="primary" className="w-full" icon={Home}>
                Back to dashboard
              </Button>
            </Link>
            <Button
              variant="secondary"
              onClick={logout}
              className="flex-1"
              icon={LogOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
