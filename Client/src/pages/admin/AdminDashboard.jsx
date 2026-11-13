import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTeams: 0,
    activeTeams: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Concurrent fetch for user and team totals
      const [totalUsersRes, activeUsersRes, teamsRes] = await Promise.all([
        api.get('/users?limit=1'),
        api.get('/users?isActive=true&limit=1'),
        api.get('/teams'),
      ]);

      const totalUsers = totalUsersRes.data?.data?.pagination?.total ?? 0;
      const activeUsers = activeUsersRes.data?.data?.pagination?.total ?? 0;
      const teams = teamsRes.data?.data ?? [];
      const totalTeams = teams.length;
      const activeTeams = teams.filter((t) => t.isActive).length;

      setStats({
        totalUsers,
        activeUsers,
        totalTeams,
        activeTeams,
      });
    } catch (err) {
      console.error('Error fetching admin statistics:', err);
      const msg = err.response?.data?.message || 'Failed to load dashboard metrics.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200 mb-2">
              Admin Portal
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome, {user?.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview of chapter members, assigned teams, and platform metrics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition"
              title="Refresh statistics"
            >
              <svg
                className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between">
          <p>{error}</p>
          <button
            onClick={fetchStats}
            className="font-semibold underline hover:text-rose-900 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Users Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Users
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
            ) : (
              <p className="text-3xl font-extrabold text-slate-900">{stats.totalUsers}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">Registered chapter members</p>
          </div>
        </div>

        {/* Active Users Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Users
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
            ) : (
              <p className="text-3xl font-extrabold text-emerald-600">{stats.activeUsers}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {stats.totalUsers > 0
                ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total users active`
                : 'Eligible for team assignments'}
            </p>
          </div>
        </div>

        {/* Total Teams Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Teams
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
            ) : (
              <p className="text-3xl font-extrabold text-slate-900">{stats.totalTeams}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">{stats.activeTeams} active teams</p>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/admin/users"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
              Manage Users &rarr;
            </h3>
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              Users CRUD
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Create new members, update user details, assign chapter roles, and reset passwords.
          </p>
        </Link>

        <Link
          to="/admin/teams"
          className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
              Manage Teams &rarr;
            </h3>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              Teams CRUD
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Create teams, assign team heads and assistants, and manage member rosters.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;

