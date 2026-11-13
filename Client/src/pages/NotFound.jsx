import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from '../components/ProtectedRoute';
import Button from '../components/Button';

const NotFound = () => {
  const { user, isAuthenticated } = useAuth();
  const redirectPath = isAuthenticated && user ? getDashboardPathByRole(user.role) : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xs border border-slate-200 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-lg mb-4">
          404
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Page Not Found
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to={redirectPath} className="block w-full">
            <Button variant="primary" className="w-full" icon={Home}>
              {isAuthenticated ? 'Back to Dashboard' : 'Back to Login'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
