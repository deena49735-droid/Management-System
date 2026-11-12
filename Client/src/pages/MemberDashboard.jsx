import React from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const MemberDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
            <div>
              <span className="inline-flex items-center rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 mb-2">
                Phase 2 Placeholder
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Member Dashboard
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                View earned points, weekly penalties, proof photo uploads, and chapter leaderboard.
              </p>
            </div>

            <button
              onClick={logout}
              className="mt-3 sm:mt-0 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition"
            >
              Logout
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Logged In As</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.phone}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Role</p>
              <p className="mt-1 text-lg font-bold text-indigo-700 capitalize">Chapter Member</p>
              <p className="text-xs text-slate-500">Team: {user?.team?.name || 'Unassigned'}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Next Step (Phase 4 & 5)</p>
              <p className="mt-1 text-sm font-medium text-slate-700">Points & Leaderboard</p>
              <p className="text-xs text-slate-500">Real-time approved points passbook & rankings</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberDashboard;

