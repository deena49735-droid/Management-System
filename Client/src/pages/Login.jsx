import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LogIn,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Trophy,
  ShieldCheck,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from '../components/ProtectedRoute';
import Button from '../components/Button';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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
    setErrorMessage('');

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser = await login(trimmedUsername, password, remember);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      const targetPath = getDashboardPathByRole(loggedInUser.role);
      navigate(targetPath, { replace: true });
    } catch (error) {
      const msg =
        error.response?.data?.message || 'Invalid username or password. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Column: Brand Panel (Desktop only or prominent on lg) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-brand-700 to-brand-800 p-10 flex-col justify-between text-white relative overflow-hidden">
          {/* Subtle decorative circles */}
          <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-brand-600/30 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-brand-900/50 blur-3xl pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm border border-white/20 mb-6 shadow-sm">
              <span className="text-2xl font-bold tracking-tight">K</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Kadambas Game
            </h1>
            <p className="mt-2 text-sm text-brand-100 leading-relaxed">
              Performance tracking, chapter attendance, and team points management system.
            </p>
          </div>

          {/* Feature Points */}
          <div className="relative z-10 space-y-4 my-8">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Transparent points ledger</h2>
                <p className="text-xs text-brand-200 mt-0.5">
                  Audited activity points and team scores calculated from approved records.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shrink-0">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Weekly meeting sheets</h2>
                <p className="text-xs text-brand-200 mt-0.5">
                  Mobile-ready attendance, attire checks, and automated penalty rules.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shrink-0">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Real-time leaderboards</h2>
                <p className="text-xs text-brand-200 mt-0.5">
                  Live chapter rankings, team scorecards, and individual achievements.
                </p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="relative z-10 pt-4 border-t border-brand-600/40 text-xs text-brand-200 flex items-center justify-between">
            <span>Kadambas Chapter</span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" /> Secure platform
            </span>
          </div>
        </div>

        {/* Right Column: Sign In Form */}
        <div className="col-span-1 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          {/* Mobile-only branding header */}
          <div className="lg:hidden text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
              <span className="text-xl font-bold tracking-tight">K</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              Kadambas Game
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Sign in to manage your points, meetings, and team rankings
            </p>
          </div>

          <div className="max-w-md w-full mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Sign in to your account
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your username and password provided by the chapter admin.
              </p>
            </div>

            {/* Inline error alert */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your username"
                    className="block w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your password"
                    className="block w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Keep me signed in option */}
              <div className="flex items-start gap-2 pt-0.5">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-slate-700 cursor-pointer select-none">
                  <span className="font-medium">Keep me signed in</span>
                  <span className="block text-[11px] text-slate-400">Use only on your own device</span>
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full"
                  icon={LogIn}
                >
                  Sign in
                </Button>
              </div>
            </form>

            {/* Admin Note */}
            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-slate-500">
                Accounts are managed by the chapter administrator. Contact your team head or admin if you need assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
