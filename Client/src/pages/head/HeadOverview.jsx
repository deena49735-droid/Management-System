import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  Trophy,
  Award,
  Calendar,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/Skeleton';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const HeadOverview = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamPointsMonth, setTeamPointsMonth] = useState(0);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHeadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teamRes, memberEntriesRes, teamEntriesRes, leaderboardRes, meetingsRes] =
        await Promise.all([
          api.get('/teams/my'),
          api.get('/entries', { params: { status: 'pending' } }),
          api.get('/team-entries', { params: { status: 'pending' } }),
          api.get('/leaderboard/teams', { params: { period: 'month' } }),
          api.get('/meetings'),
        ]);

      const teamData = teamRes.data?.data;
      setTeam(teamData);

      const membersList = memberEntriesRes.data?.data || [];
      const teamList = teamEntriesRes.data?.data || [];
      const combinedPending = [
        ...membersList.map((m) => ({ ...m, entryKind: 'Member' })),
        ...teamList.map((t) => ({ ...t, entryKind: 'Team' })),
      ];

      setPendingEntries(combinedPending.slice(0, 5));
      setPendingApprovalsCount(combinedPending.length);

      const teamsList = leaderboardRes.data?.data || [];
      setTotalTeams(teamsList.length);
      const myRankEntry = teamsList.find((t) => t.teamId === teamData?._id);
      if (myRankEntry) {
        setTeamRank(myRankEntry.rank);
        setTeamPointsMonth(myRankEntry.total ?? myRankEntry.totalPoints ?? 0);
      }

      setRecentMeetings((meetingsRes.data?.data || []).slice(0, 5));
    } catch (err) {
      console.error('Failed to load team head dashboard:', err);
      const msg = err.response?.data?.message || 'Failed to load team overview.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeadData();
  }, []);

  const greeting = `${getGreeting()}, ${user?.name || 'Team Head'}`;

  if (!loading && !team) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={greeting}
          subtitle="Team Head • Account not currently assigned to a team"
        />
        <EmptyState
          icon={AlertCircle}
          title="No team assignment"
          description="Your user account is not currently assigned as Head of any chapter team. Please contact the administrator."
        />
      </div>
    );
  }

  const allMembers = [
    ...(team?.head ? [{ ...team.head, teamRole: 'Team Head' }] : []),
    ...(team?.assistant ? [{ ...team.assistant, teamRole: 'Team Assistant' }] : []),
    ...(team?.members || []).map((m) => ({ ...m, teamRole: 'Member' })),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={greeting}
        subtitle={`Team Head • Managing ${team?.name || 'Team'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/head/approvals">
              <Button variant="primary" size="sm" icon={CheckCircle2}>
                Review Approvals
                {pendingApprovalsCount > 0 && (
                  <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchHeadData}
              isLoading={loading}
              icon={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error Banner with Retry */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
          <Button variant="danger" size="sm" onClick={fetchHeadData}>
            Retry
          </Button>
        </div>
      )}

      {/* 1. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Team Members"
          value={allMembers.length}
          icon={Users}
          variant="blue"
          hint={`Including head & assistant`}
          loading={loading}
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovalsCount}
          icon={Clock}
          variant="amber"
          hint={pendingApprovalsCount > 0 ? 'Review entries now' : 'All approved'}
          hintType={pendingApprovalsCount > 0 ? 'warning' : 'neutral'}
          loading={loading}
          onClick={() => {}}
        />
        <StatCard
          label="My Team Rank"
          value={teamRank ? `#${teamRank}` : '—'}
          icon={Trophy}
          variant="indigo"
          hint={totalTeams > 0 ? `Out of ${totalTeams} teams` : 'This month'}
          loading={loading}
        />
        <StatCard
          label="Team Points (Month)"
          value={teamPointsMonth.toLocaleString()}
          icon={Award}
          variant="emerald"
          hint="Approved monthly total"
          hintType="success"
          loading={loading}
        />
      </div>

      {/* 2. Needs Your Approval & Recent Meetings (Two columns on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section: Needs Your Approval */}
        <Card
          title="Needs Your Approval"
          subtitle="Recent pending submissions awaiting review"
          action={
            <Link
              to="/head/approvals"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View all ({pendingApprovalsCount})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : pendingEntries.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No pending approvals"
              description="All submitted member and team entries have been reviewed."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingEntries.map((entry) => (
                <div
                  key={entry._id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {entry.criteria?.name || 'Point Entry'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {entry.member?.name ? `${entry.member.name} • ` : ''}
                      {formatDate(entry.date || entry.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        (entry.points || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {(entry.points || 0) < 0 ? entry.points : `+${entry.points}`} pts
                    </span>
                    <Badge status="pending" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section: Recent Meetings */}
        <Card
          title="Recent Meetings"
          subtitle="Chapter weekly attendance sheets"
          action={
            <Link
              to="/head/meetings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentMeetings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No recent meetings"
              description="Meeting attendance sheets will appear here once created by your team assistant."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentMeetings.map((m) => (
                <Link
                  key={m._id}
                  to={`/head/meetings/${m._id}`}
                  className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition truncate">
                      {formatDate(m.date)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      Week {m.weekNumber} • Month {m.month}/{m.year}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        m.totalPoints < 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {m.totalPoints < 0 ? m.totalPoints : `+${m.totalPoints}`} pts
                    </span>
                    <Badge status={m.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 3. Section: Team Members */}
      <Card
        title="Team Members"
        subtitle={`Roster for ${team?.name} (${allMembers.length} active members)`}
      >
        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : allMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members in team"
            description="Contact administrator to assign chapter members to your team."
          />
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5 sm:-mx-6 sm:-my-6">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-5 py-3.5">Username</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5 text-right">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allMembers.map((m, idx) => (
                  <tr key={m._id || idx} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} size="sm" />
                        <span className="truncate">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {m.username ? `@${m.username}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {m.phone || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                          m.teamRole === 'Team Head'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : m.teamRole === 'Team Assistant'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {m.teamRole}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default HeadOverview;
