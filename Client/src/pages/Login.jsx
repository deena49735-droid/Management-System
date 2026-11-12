import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from '../components/ProtectedRoute';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  // If already logged in, automatically forward to the appropriate dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(getDashboardPathByRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || !password) {
      toast.error('Please enter both your phone number and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser = await login(trimmedPhone, password);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      const targetPath = getDashboardPathByRole(loggedInUser.role);
      navigate(targetPath, { replace: true });
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || 'Login failed. Please verify your phone number and password.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Title & Branding */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
            <span className="text-2xl font-extrabold tracking-tight">K</span>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Kadambas Game
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Sign in to track points, approvals, and chapter rankings
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="block w-full min-h-[48px] rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-base transition sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="block w-full min-h-[48px] rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 text-base transition sm:text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Accounts are created by the chapter admin. Please contact your team lead or admin if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

