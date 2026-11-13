import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import EntriesTable from '../../components/EntriesTable';

const AssistantOverview = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true);
        const [teamRes, entriesRes, leaderboardRes] = await Promise.all([
          api.get('/teams/my'),
          api.get('/entries', { params: { status: 'pending' } }),
          api.get('/leaderboard/teams', { params: { period: 'month' } }),
        ]);

        const teamData = teamRes.data.data;
        setTeam(teamData);
        const myPending = (entriesRes.data.data || []).filter(
          (e) => e.enteredBy?._id === user?._id
        );
        setMyPendingCount(myPending.length);
        setRecentEntries(entriesRes.data.data?.slice(0, 5) || []);

        const teamsList = leaderboardRes.data.data || [];
        setTotalTeams(teamsList.length);
        const myRankEntry = teamsList.find((t) => t.teamId === teamData?._id);
        if (myRankEntry) {
          setTeamRank(myRankEntry.rank);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load assistant dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, [user?._id]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading assistant overview...</p>
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

  const memberCount =
    (team.members?.length || 0) + (team.head ? 1 : 0) + (team.assistant ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Team Assistant Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user?.name}. Managing point entries for <span className="font-semibold text-emerald-700">{team.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/assistant/entries/new"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition"
          >
            <span>+ Add Member Entry</span>
          </Link>
          <Link
            to="/assistant/team-points"
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span>Team Points</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Team Name</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 truncate">{team.name}</p>
          <p className="mt-1 text-xs text-slate-400">Chapter Team</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">My Team Rank</p>
          <p className="mt-2 text-2xl font-extrabold text-indigo-600">
            {teamRank !== null ? `#${teamRank} of ${totalTeams}` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">This month standings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Team Members</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">{memberCount}</p>
          <p className="mt-1 text-xs text-slate-400">Total active members</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">My Pending Submissions</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-600">{myPendingCount}</p>
          <p className="mt-1 text-xs text-slate-400">Awaiting Team Head approval</p>
        </div>
      </div>

      {/* Quick Action Info Banner */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-emerald-900">Need to record this week's activities?</h3>
          <p className="text-xs text-emerald-700 mt-0.5">
            You can enter attendance, 1-to-1s, referrals, training, or visitor points for members of your team.
          </p>
        </div>
        <Link
          to="/assistant/entries/new"
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
        >
          Open Quick-Entry Form &rarr;
        </Link>
      </div>

      {/* Recent Team Activity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            Recent Team Submissions
          </h2>
          <Link to="/assistant/submissions" className="text-xs font-semibold text-emerald-700 hover:underline">
            View all submissions &rarr;
          </Link>
        </div>

        <EntriesTable
          entries={recentEntries}
          loading={loading}
          emptyMessage="No submissions recorded yet."
        />
      </div>
    </div>
  );
};

export default AssistantOverview;

