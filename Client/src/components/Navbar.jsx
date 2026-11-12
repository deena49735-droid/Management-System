import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathByRole } from './ProtectedRoute';

const roleLabels = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  teamLead: { label: 'Team Lead', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  teamAssistant: { label: 'Team Assistant', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  member: { label: 'Member', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const Navbar = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleInfo = roleLabels[user.role] || {
    label: user.role,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const homePath = getDashboardPathByRole(user.role);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand / Logo */}
        <Link to={homePath} className="flex items-center gap-2 text-indigo-600 font-bold text-lg tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 font-extrabold text-base">
            K
          </div>
          <span>Kadambas Game</span>
        </Link>

        {/* User profile & actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</span>
            <span className="text-xs text-slate-500">{user.phone}</span>
          </div>

          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${roleInfo.color}`}
          >
            {roleInfo.label}
          </span>

          <button
            onClick={logout}
            className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            title="Log out of Kadambas Game"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

