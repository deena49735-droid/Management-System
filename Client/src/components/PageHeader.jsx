import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from './ProtectedRoute';

const dashboardPaths = ['/admin', '/head', '/assistant', '/dashboard'];

const PageHeader = ({
  title,
  subtitle,
  actions,
  action,
  badge,
  backTo,
  showBack,
  className = '',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const actionContent = actions || action;

  const isDashboard = dashboardPaths.includes(location.pathname);
  // Default to showing back button on all non-dashboard pages unless explicitly overridden
  const shouldShowBack = showBack !== undefined ? showBack : !isDashboard;

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      const fallback = user ? getDashboardPathByRole(user.role) : '/';
      navigate(fallback);
    }
  };

  return (
    <div className={`mb-6 space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Optional Back Button + Title */}
        <div className="flex items-center gap-3 min-w-0">
          {shouldShowBack && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
              title="Go back"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 leading-snug truncate">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions (Full width below on mobile, aligned on right on sm+) */}
        {actionContent && (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
            {actionContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
