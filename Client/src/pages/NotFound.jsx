import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from '../components/ProtectedRoute';

const NotFound = () => {
  const { user, isAuthenticated } = useAuth();
  const redirectPath = isAuthenticated && user ? getDashboardPathByRole(user.role) : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 font-extrabold text-xl mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to={redirectPath}
            className="inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition"
          >
            {isAuthenticated ? 'Back to Dashboard' : 'Back to Login'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

