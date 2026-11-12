import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';

const LeadOverview = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [pendingMembersCount, setPendingMembersCount] = useState(0);
  const [pendingTeamCount, setPendingTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        setLoading(true);
        const [teamRes, memberEntriesRes, teamEntriesRes] = await Promise.all([
          api.get('/teams/my'),
          api.get('/entries', { params: { status: 'pending' } }),
          api.get('/team-entries', { params: { status: 'pending' } }),
        ]);

        setTeam(teamRes.data.data);
        setPendingMembersCount(memberEntriesRes.data.data?.length || 0);
        setPendingTeamCount(teamEntriesRes.data.data?.length || 0);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load team data.');
      } finally {
        setLoading(false);
      }
    };

    loadOverviewData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading team overview...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-800">You are not assigned to any team.</p>
        <p className="text-xs text-slate-500 mt-1">Please contact your administrator to get assigned to a team.</p>
      </div>
    );
  }

  const allMembers = [
    ...(team.lead ? [{ ...team.lead, teamRole: 'Team Lead' }] : []),
    ...(team.assistant ? [{ ...team.assistant, teamRole: 'Team Assistant' }] : []),
    ...(team.members || []).map((m) => ({ ...m, teamRole: 'Member' })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Team Lead Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user?.name}. Managing team <span className="font-semibold text-blue-700">{team.name}</span>.
          </p>
        </div>

        <Link
          to="/lead/approvals"
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-blue-700 active:bg-blue-800 transition"
        >
          <span>Review Approvals</span>
          {pendingMembersCount + pendingTeamCount > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              {pendingMembersCount + pendingTeamCount}
            </span>
          )}
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Team Name</p>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900 truncate">{team.name}</p>
          <p className="mt-1 text-xs text-slate-400">Chapter Team</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Members Count</p>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-blue-700">
            {allMembers.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">Including Lead & Assistant</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Pending Member Entries</p>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-amber-600">
            {pendingMembersCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">Awaiting your approval</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Pending Team Points</p>
          <p className="mt-2 text-xl sm:text-2xl font-extrabold text-indigo-600">
            {pendingTeamCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">Monthly / Bonus claims</p>
        </div>
      </div>

      {/* Team Members List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            Team Members ({allMembers.length})
          </h2>
          <span className="text-xs text-slate-500">From /api/teams/my</span>
        </div>

        {/* Mobile View */}
        <div className="grid grid-cols-1 gap-2.5 sm:hidden">
          {allMembers.map((m) => (
            <div
              key={m._id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">{m.phone}</p>
              </div>
              <Badge role={m.role}>{m.teamRole}</Badge>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member Name</th>
                <th className="px-5 py-3">Phone Number</th>
                <th className="px-5 py-3 text-right">Team Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allMembers.map((m) => (
                <tr key={m._id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{m.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{m.phone}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge role={m.role}>{m.teamRole}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeadOverview;

