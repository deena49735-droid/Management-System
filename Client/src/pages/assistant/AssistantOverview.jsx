import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Trophy,
  Award,
  Calendar,
  PlusCircle,
  BarChart3,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useApprovals } from '../../context/ApprovalsContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { Skeleton, SkeletonCard } from '../../components/Skeleton';

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

const AssistantOverview = () => {
  const { user } = useAuth();
  const { pendingCount, setPendingCount, refreshPendingCount } = useApprovals();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [memberScores, setMemberScores] = useState([]);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamPointsMonth, setTeamPointsMonth] = useState(0);
  const [teamAvgPointsMonth, setTeamAvgPointsMonth] = useState(0);
  const [myRecentSubmissions, setMyRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssistantData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teamRes, entriesRes, leaderboardRes] = await Promise.all([
        api.get('/teams/my'),
        api.get('/entries', { params: { _t: Date.now() } }),
        api.get('/leaderboard/teams', { params: { period: 'month' } }),
      ]);

      const teamData = teamRes.data?.data;
      setTeam(teamData);

      const allEntries = entriesRes.data?.data || [];
      // Submissions this assistant can approve/reject
      const actionablePending = allEntries.filter(
        (e) => e.status === 'pending' && e.canActOnMine !== false
      );
      setPendingCount(actionablePending.length);

      // Filter submissions entered by this assistant
      const myEntries = allEntries.filter(
        (e) => (e.enteredBy?._id || e.enteredBy) === user?._id
      );

      const pendingList = myEntries.filter((e) => e.status === 'pending');
      setMyPendingCount(pendingList.length);
      setMyRecentSubmissions(myEntries.slice(0, 6));

      const teamsList = leaderboardRes.data?.data || [];
      setTotalTeams(teamsList.length);
      const myRankEntry = teamsList.find((t) => t.teamId === teamData?._id);
      if (myRankEntry) {
        setTeamRank(myRankEntry.rank);
        setTeamPointsMonth(myRankEntry.total ?? myRankEntry.totalPoints ?? 0);
        setTeamAvgPointsMonth(
          myRankEntry.averageRounded ??
            (myRankEntry.memberCount ? (myRankEntry.total ?? 0) / myRankEntry.memberCount : 0)
        );
      }

      // Fetch member scores strictly for this team (This Month)
      const myTeamId = user?.team?._id || user?.team || teamData?._id;
      if (myTeamId) {
        try {
          const scoresRes = await api.get('/leaderboard/members', {
            params: { period: 'month', team: myTeamId },
          });
          setMemberScores(scoresRes.data?.data || []);
        } catch (scoresErr) {
          console.warn('Could not load team member scores:', scoresErr);
          setMemberScores([]);
        }
      } else {
        setMemberScores([]);
      }
    } catch (err) {
      console.error('Failed to load assistant dashboard:', err);
      const msg = err.response?.data?.message || 'Failed to load assistant dashboard.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistantData();
  }, [user?._id]);

  // Listen for live approval events to keep stat card in sync
  useEffect(() => {
    const handleApprovalChanged = () => {
      refreshPendingCount();
      fetchAssistantData();
    };

    window.addEventListener('kadambas:approvals-changed', handleApprovalChanged);
    return () => {
      window.removeEventListener('kadambas:approvals-changed', handleApprovalChanged);
    };
  }, [refreshPendingCount]);

  const greeting = `${getGreeting()}, ${user?.name || 'Team Assistant'}`;

  if (!loading && !team) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={greeting}
          subtitle="Team Assistant • Account not currently assigned to a team"
        />
        <EmptyState
          icon={AlertCircle}
          title="No team assignment"
          description="Your account is not currently assigned as Assistant of any chapter team. Please contact your administrator."
        />
      </div>
    );
  }

  const memberCount =
    (team?.members?.length || 0) + (team?.head ? 1 : 0) + (team?.assistant ? 1 : 0);

  const rawRoster = [
    ...(team?.head ? [{ ...team.head, roleLabel: 'Head' }] : []),
    ...(team?.assistant ? [{ ...team.assistant, roleLabel: 'Assistant' }] : []),
    ...(team?.members || []).map((m) => ({ ...m, roleLabel: 'Member' })),
  ];
  const uniqueRoster = Array.from(
    new Map(rawRoster.filter((m) => m && m._id).map((m) => [m._id, m])).values()
  );

  const memberScoresMap = useMemo(() => {
    const map = {};
    (memberScores || []).forEach((m) => {
      const uid = (m.userId || m._id)?.toString();
      if (uid) map[uid] = m;
    });
    return map;
  }, [memberScores]);

  const sortedRoster = useMemo(() => {
    return [...uniqueRoster].sort((a, b) => {
      const aScore = memberScoresMap[a._id?.toString()]?.total ?? 0;
      const bScore = memberScoresMap[b._id?.toString()]?.total ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [uniqueRoster, memberScoresMap]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={greeting}
        subtitle={`Team Assistant • Managing points and meetings for ${team?.name || 'Team'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={PlusCircle}
              onClick={() => navigate('/assistant/entries/new')}
            >
              Submit Activity
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchAssistantData}
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
          <Button variant="danger" size="sm" onClick={fetchAssistantData}>
            Retry
          </Button>
        </div>
      )}

      {/* 1. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Team Members"
          value={memberCount}
          icon={Users}
          variant="brand"
          hint={`Active squad roster`}
          loading={loading}
        />
        <Link to="/assistant/approvals" className="block focus:outline-hidden">
          <StatCard
            label="Pending Approvals"
            value={pendingCount}
            icon={CheckCircle2}
            variant="amber"
            hint={pendingCount > 0 ? 'Awaiting your review' : 'All clear'}
            hintType={pendingCount > 0 ? 'warning' : 'neutral'}
            loading={loading}
          />
        </Link>
        <StatCard
          label="Team Rank (This Month)"
          value={teamRank ? `#${teamRank}` : '—'}
          icon={Trophy}
          variant="brand"
          hint={totalTeams > 0 ? `Out of ${totalTeams} teams` : 'This month'}
          loading={loading}
        />
        <StatCard
          label="Team Points (This Month)"
          value={teamPointsMonth.toLocaleString()}
          icon={Award}
          variant="emerald"
          hint={`Total: ${teamPointsMonth} pts • Avg: ${Number(teamAvgPointsMonth).toFixed(2)} / mbr`}
          hintType="success"
          loading={loading}
        />
      </div>

      {/* 2. Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Link
          to="/assistant/meetings"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                New Meeting Sheet
              </p>
              <p className="text-xs text-slate-500">Weekly attendance & points</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          to="/assistant/entries/new"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Add Member Entry
              </p>
              <p className="text-xs text-slate-500">Daily & weekly activities</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </Link>

        <Link
          to="/assistant/scorecard"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Team Scorecard
              </p>
              <p className="text-xs text-slate-500">Monthly targets & bonus</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>
      </div>

      {/* 3. Section: My Recent Submissions */}
      <Card
        title="My Recent Submissions"
        subtitle="Point entries you submitted for your team"
        action={
          <Link
            to="/assistant/submissions"
            className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
          >
            <span>View all submissions</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : myRecentSubmissions.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="No submissions yet"
            description="Submit meeting sheets or member activities to record game points."
            actionLabel="Submit First Entry"
            onAction={() => navigate('/assistant/entries/new')}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {myRecentSubmissions.map((entry) => (
              <div
                key={entry._id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {entry.criteria?.name || 'Point Entry'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {entry.member?.name ? `${entry.member.name} • ` : ''}
                    {formatDate(entry.date || entry.createdAt)}
                    {entry.quantity > 1 ? ` • Qty ${entry.quantity}` : ''}
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
                  <Badge status={entry.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. Section: Team Members */}
      <Card
        title="Team Members"
        subtitle={`Roster for ${team?.name || 'Team'} (${memberCount} active members) • Member Scores (This Month)`}
        action={
          <Link
            to="/assistant/team"
            className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
          >
            <span>Manage team</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : sortedRoster.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members in team"
            description="Contact administrator to assign chapter members to your team."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedRoster.map((m, idx) => {
              const scoreObj = memberScoresMap[m._id?.toString()];
              const score = scoreObj?.total ?? 0;

              return (
                <div key={m._id || idx} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">@{m.username} • {m.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${
                        score > 0
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                          : score < 0
                          ? 'text-rose-700 bg-rose-50 border-rose-100'
                          : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}
                    >
                      {score > 0 ? `+${score}` : score} pts
                    </span>
                    <Badge role={m.role} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AssistantOverview;
