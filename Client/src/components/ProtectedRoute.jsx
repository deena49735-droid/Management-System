import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Helper to get default dashboard path by role
 */
export const getDashboardPathByRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'teamLead':
      return '/lead';
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
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
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-600">
            You do not have permission to view this page.
          </p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 text-left">
            <p><span className="font-semibold text-slate-700">Your role:</span> {user.role}</p>
            <p><span className="font-semibold text-slate-700">Required role(s):</span> {roles.join(', ')}</p>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to={homePath}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Go to Your Dashboard
            </Link>
            <button
              onClick={logout}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
