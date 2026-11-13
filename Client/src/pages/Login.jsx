import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from '../components/ProtectedRoute';
import Button from '../components/Button';

const Login = () => {
  const [username, setUsername] = useState('');
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

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername || !password) {
      toast.error('Please enter both your username and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser = await login(trimmedUsername, password);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      const targetPath = getDashboardPathByRole(loggedInUser.role);
      navigate(targetPath, { replace: true });
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || 'Login failed. Please verify your username and password.';
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <span className="text-xl font-bold tracking-tight">K</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Kadambas Game
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to track points, approvals, and chapter rankings
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 rounded-xl bg-white p-6 shadow-xs border border-slate-200 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or username"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
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
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full"
                icon={LogIn}
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Quick Demo Credentials Reminder */}
          <div className="mt-6 rounded-lg bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Quick Chapter Roles:</p>
            <p>Admin: <span className="font-mono text-slate-600">admin / admin123</span></p>
            <p>Team Head: <span className="font-mono text-slate-600">head / head123</span></p>
            <p>Team Assistant: <span className="font-mono text-slate-600">assistant / assist123</span></p>
            <p>Member: <span className="font-mono text-slate-600">member / member123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
