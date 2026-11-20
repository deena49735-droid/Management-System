import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Shield,
  Clock,
  Trophy,
  Calendar,
  UserPlus,
  ShieldPlus,
  BookOpen,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  PlusCircle,
  Medal,
  Award,
  ChevronRight,
  CheckCircle2,
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
import Modal from '../../components/Modal';
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

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTeams: 0,
    pendingApprovals: 0,
  });
  const [topTeams, setTopTeams] = useState([]);
  const [allRankedTeams, setAllRankedTeams] = useState([]);
  const [topMembers, setTopMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Team Scoring Details Modal state
  const [selectedTeamModal, setSelectedTeamModal] = useState(null);
  const [teamModalDetails, setTeamModalDetails] = useState(null);
  const [loadingTeamModal, setLoadingTeamModal] = useState(false);
  const [teamModalError, setTeamModalError] = useState(null);

  // Member Scoring Details Modal state
  const [selectedMemberModal, setSelectedMemberModal] = useState(null);
  const [memberModalDetails, setMemberModalDetails] = useState(null);
  const [loadingMemberModal, setLoadingMemberModal] = useState(false);
  const [memberModalError, setMemberModalError] = useState(null);

  const fetchTeamScoringDetails = async (teamId) => {
    try {
      setLoadingTeamModal(true);
      setTeamModalError(null);
      const res = await api.get('/entries/by-period', {
        params: { team: teamId },
      });
      setTeamModalDetails(res.data?.data);
    } catch (err) {
      console.error('Failed to load team scoring details:', err);
      const msg = err.response?.data?.message || 'Failed to load scoring details for this team.';
      setTeamModalError(msg);
    } finally {
      setLoadingTeamModal(false);
    }
  };

  const handleOpenTeamModal = (team) => {
    const tid = (team.teamId || team._id)?.toString();
    setSelectedTeamModal(team);
    setTeamModalDetails(null);
    setTeamModalError(null);
    if (tid) {
      fetchTeamScoringDetails(tid);
    }
  };

  const handleCloseTeamModal = () => {
    setSelectedTeamModal(null);
    setTeamModalDetails(null);
    setTeamModalError(null);
  };

  const fetchMemberScoringDetails = async (userId) => {
    try {
      setLoadingMemberModal(true);
      setMemberModalError(null);
      const res = await api.get('/entries/by-period', {
        params: { member: userId },
      });
      setMemberModalDetails(res.data?.data);
    } catch (err) {
      console.error('Failed to load member scoring details:', err);
      const msg = err.response?.data?.message || 'Failed to load scoring details for this member.';
      setMemberModalError(msg);
    } finally {
      setLoadingMemberModal(false);
    }
  };

  const handleOpenMemberModal = (member) => {
    const uid = (member.userId || member._id)?.toString();
    setSelectedMemberModal(member);
    setMemberModalDetails(null);
    setMemberModalError(null);
    if (uid) {
      fetchMemberScoringDetails(uid);
    }
  };

  const handleCloseMemberModal = () => {
    setSelectedMemberModal(null);
    setMemberModalDetails(null);
    setMemberModalError(null);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        totalUsersRes,
        activeUsersRes,
        teamsRes,
        memberPendingRes,
        teamPendingRes,
        teamLeaderboardRes,
        memberLeaderboardRes,
        meetingsRes,
      ] = await Promise.all([
        api.get('/users?limit=1'),
        api.get('/users?isActive=true&limit=1'),
        api.get('/teams'),
        api.get('/entries', { params: { status: 'pending' } }),
        api.get('/team-entries', { params: { status: 'pending' } }),
        api.get('/leaderboard/teams', { params: { period: 'month' } }),
        api.get('/leaderboard/members', { params: { period: 'month' } }),
        api.get('/meetings'),
      ]);

      const totalUsers = totalUsersRes.data?.data?.pagination?.total ?? 0;
      const activeUsers = activeUsersRes.data?.data?.pagination?.total ?? 0;
      const loadedTeams = teamsRes.data?.data ?? [];
      const pendingApprovals =
        (memberPendingRes.data?.data?.length || 0) +
        (teamPendingRes.data?.data?.length || 0);

      setStats({
        totalUsers,
        activeUsers,
        totalTeams: loadedTeams.length,
        pendingApprovals,
      });

      setTeams(loadedTeams);
      const rankedTeams = teamLeaderboardRes.data?.data || [];
      setAllRankedTeams(rankedTeams);
      setTopTeams(rankedTeams.slice(0, 5));
      setTopMembers((memberLeaderboardRes.data?.data || []).slice(0, 5));
      setRecentMeetings((meetingsRes.data?.data || []).slice(0, 5));
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      const msg = err.response?.data?.message || 'Failed to load dashboard metrics.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const teamScoresMap = useMemo(() => {
    const map = {};
    (allRankedTeams || []).forEach((t) => {
      const tid = (t.teamId || t._id)?.toString();
      if (tid) map[tid] = t;
    });
    return map;
  }, [allRankedTeams]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen for live approval & submission events to keep stats in sync without manual refresh
  useEffect(() => {
    const handleApprovalChanged = () => {
      fetchDashboardData();
    };

    window.addEventListener('kadambas:approvals-changed', handleApprovalChanged);
    return () => {
      window.removeEventListener('kadambas:approvals-changed', handleApprovalChanged);
    };
  }, []);

  const greeting = `${getGreeting()}, ${user?.name || 'Admin'}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={greeting}
        subtitle="Platform Administrator • Overview of members, teams, chapter rankings, and meetings"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/entries/new">
              <Button variant="primary" size="sm" icon={PlusCircle}>
                Submit Entry
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDashboardData}
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
          <Button variant="danger" size="sm" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* 1. Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={stats.totalUsers}
          icon={Users}
          variant="brand"
          hint="Registered chapter members"
          loading={loading}
        />
        <StatCard
          label="Active Members"
          value={stats.activeUsers}
          icon={UserCheck}
          variant="emerald"
          hint={
            stats.totalUsers > 0
              ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% active members`
              : 'Eligible for roster'
          }
          hintType="success"
          loading={loading}
        />
        <StatCard
          label="Teams"
          value={stats.totalTeams}
          icon={Shield}
          variant="brand"
          hint="Active competitive squads"
          loading={loading}
        />
        <StatCard
          label="Pending Approvals"
          value={stats.pendingApprovals}
          icon={Clock}
          variant="amber"
          hint={stats.pendingApprovals > 0 ? 'Awaiting verification' : 'Ledger fully up to date'}
          hintType={stats.pendingApprovals > 0 ? 'warning' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* 2. Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Link
          to="/admin/entries/new"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Submit Entry
              </p>
              <p className="text-xs text-slate-500">Record activity or penalty</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          to="/admin/users"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Add Member
              </p>
              <p className="text-xs text-slate-500">Create & manage member accounts</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          to="/admin/teams"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                Add Team
              </p>
              <p className="text-xs text-slate-500">Configure teams & heads</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
        </Link>

        <Link
          to="/criteria"
          className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Game Criteria
              </p>
              <p className="text-xs text-slate-500">Official rules & scoring</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </Link>
      </div>

      {/* 3. Team Standings & Member Scores Summary (Two Columns on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section: Team Standings */}
        <Card
          title="Team Standings (This Month)"
          subtitle="Top performing chapter teams"
          action={
            <Link
              to="/leaderboard"
              className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : topTeams.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No standings recorded"
              description="Team scores will appear here once meeting sheets or monthly points are approved."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {topTeams.map((team, idx) => {
                const teamScore = team.total ?? team.totalPoints ?? 0;
                const teamAvg = team.averageRounded ?? (team.memberCount ? teamScore / team.memberCount : 0);
                const firstTeamAvg = topTeams[0]?.averageRounded ?? (topTeams[0]?.memberCount ? (topTeams[0]?.total ?? 0) / topTeams[0].memberCount : 1);
                const maxAvg = firstTeamAvg > 0 ? firstTeamAvg : 1;
                const percent = Math.max(8, Math.min(100, Math.round((teamAvg / maxAvg) * 100)));

                return (
                  <div
                    key={team.teamId || idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenTeamModal(team)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenTeamModal(team);
                      }
                    }}
                    className="p-2.5 -mx-2.5 rounded-xl transition-colors cursor-pointer hover:bg-slate-50/90 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 group space-y-1.5"
                    aria-label={`View scoring details for ${team.name || team.teamName}`}
                  >
                    <div className="flex items-center justify-between text-sm gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${idx === 0
                              ? 'bg-amber-100 text-amber-800'
                              : idx === 1
                                ? 'bg-slate-200 text-slate-700'
                                : idx === 2
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                          #{team.rank || idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                          {team.name || team.teamName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-slate-900 tabular-nums block text-xs sm:text-sm">
                            Avg: {team.averageRounded != null ? team.averageRounded.toFixed(2) : (team.memberCount ? (teamScore / team.memberCount).toFixed(2) : '0.00')} pts
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            Total: {teamScore.toLocaleString()} pts • {team.memberCount || 0} mbrs
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${idx === 0
                            ? 'bg-amber-500'
                            : idx === 1
                                ? 'bg-brand-500'
                                : 'bg-brand-200'
                          }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Section: Top Member Scores Summary */}
        <Card
          title="Top Member Scores (This Month)"
          subtitle="Top performing chapter members"
          action={
            <Link
              to="/leaderboard"
              className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : topMembers.length === 0 ? (
            <EmptyState
              icon={Medal}
              title="No member scores yet"
              description="Member scores will appear here once earned activity points are approved."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {topMembers.map((member, idx) => {
                const totalScore = member.total ?? 0;
                const isNegative = totalScore < 0;

                return (
                  <div
                    key={member.userId || idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenMemberModal(member)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenMemberModal(member);
                      }
                    }}
                    className="flex items-center justify-between p-2.5 -mx-2.5 rounded-xl transition-colors cursor-pointer hover:bg-slate-50/90 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 group"
                    aria-label={`View scoring details for ${member.name}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700'
                            : idx === 2
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        #{member.rank || idx + 1}
                      </span>
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0 truncate">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {member.team || 'Unassigned'} • @{member.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-bold tabular-nums px-2 py-0.5 rounded border text-xs ${
                          isNegative
                            ? 'text-rose-700 bg-rose-50 border-rose-100'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                        }`}
                      >
                        {totalScore > 0 ? `+${totalScore}` : totalScore} pts
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Section: Teams Overview */}
      <Card
        title="Teams Overview (This Month)"
        subtitle="Chapter teams, designated leadership, member counts, and monthly scores"
        action={
          <Link
            to="/admin/teams"
            className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
          >
            <span>Manage teams</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {loading ? (
          <SkeletonTable rows={4} cols={7} />
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No teams configured"
            description="Create chapter teams to begin assigning members and heads."
            actionLabel="Create Team"
            onAction={() => { }}
          />
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto -mx-5 -my-5 sm:-mx-6 sm:-my-6">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Team Name</th>
                    <th className="px-5 py-3.5">Team Head</th>
                    <th className="px-5 py-3.5">Team Assistant</th>
                    <th className="px-4 py-3.5 text-center">Members</th>
                    <th className="px-4 py-3.5 text-right">Total Score (This Month)</th>
                    <th className="px-4 py-3.5 text-right">Avg / Member (This Month)</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teams.map((t) => {
                    const memberCount =
                      (t.members?.length || 0) + (t.head ? 1 : 0) + (t.assistant ? 1 : 0);
                    const scoreData = teamScoresMap[t._id?.toString()];
                    const totalScore = scoreData?.total ?? 0;
                    const avgScore = scoreData?.averageRounded ?? (scoreData?.memberCount ? totalScore / scoreData.memberCount : 0);

                    return (
                      <tr key={t._id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {t.name}
                          {!t.isActive && (
                            <span className="ml-2 text-xs text-slate-400 font-normal">
                              (Inactive)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {t.head?.name ? (
                            <span className="font-medium text-slate-800">{t.head.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {t.assistant?.name ? (
                            <span className="font-medium text-slate-800">{t.assistant.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-800 tabular-nums">
                          {memberCount}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs font-bold text-slate-900 tabular-nums">
                          {totalScore.toLocaleString()} pts
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs font-semibold text-slate-700 tabular-nums">
                          {Number(avgScore).toFixed(2)} pts
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to={`/admin/teams/${t._id}`}
                            className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800 transition px-2 py-1"
                          >
                            <span>View team</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 -mx-5 -my-5">
              {teams.map((t) => {
                const memberCount =
                  (t.members?.length || 0) + (t.head ? 1 : 0) + (t.assistant ? 1 : 0);
                const scoreData = teamScoresMap[t._id?.toString()];
                const totalScore = scoreData?.total ?? 0;
                const avgScore = scoreData?.averageRounded ?? (scoreData?.memberCount ? totalScore / scoreData.memberCount : 0);

                return (
                  <div key={t._id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">
                          {t.name}
                        </h4>
                        {!t.isActive && (
                          <span className="text-xs text-slate-400 font-normal">
                            (Inactive)
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                        {memberCount} members
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-xs">Head:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {t.head?.name || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">Assistant:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {t.assistant?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Scores (This Month):</span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 tabular-nums">
                          {totalScore.toLocaleString()} pts
                        </span>
                        <span className="text-slate-500 font-normal ml-1">
                          (Avg: {Number(avgScore).toFixed(2)} / mbr)
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Link
                        to={`/admin/teams/${t._id}`}
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 rounded-lg hover:bg-brand-50 transition"
                      >
                        <span>View team</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* 5. Section: Recent Meetings */}
      <Card
        title="Recent Meetings"
        subtitle="Latest weekly attendance sheets"
        action={
          <Link
            to="/admin/meetings"
            className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 -mr-2"
          >
            <span>View all</span>
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
        ) : recentMeetings.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No recent meetings"
            description="No attendance sheets have been created yet."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {recentMeetings.map((m) => (
              <Link
                key={m._id}
                to={`/admin/meetings/${m._id}`}
                className="group flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition truncate">
                    {formatDate(m.date)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {m.team?.name ? `${m.team.name} • ` : ''}Week {m.weekNumber}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold tabular-nums ${m.totalPoints < 0 ? 'text-rose-600' : 'text-emerald-600'
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

      {/* 6. Team Scoring Details Modal */}
      <Modal
        isOpen={Boolean(selectedTeamModal)}
        onClose={handleCloseTeamModal}
        title={selectedTeamModal ? (selectedTeamModal.name || selectedTeamModal.teamName) : 'Team Details'}
        subtitle="Team Scoring Breakdown • This Month"
        maxWidth="max-w-2xl"
      >
        {selectedTeamModal && (
          <div className="space-y-4">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Points</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {(selectedTeamModal.total ?? selectedTeamModal.totalPoints ?? 0).toLocaleString()} pts
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Average / Member</p>
                <p className="text-base sm:text-lg font-bold text-brand-700 mt-0.5 tabular-nums">
                  {selectedTeamModal.averageRounded != null
                    ? selectedTeamModal.averageRounded.toFixed(2)
                    : (selectedTeamModal.memberCount ? ((selectedTeamModal.total ?? 0) / selectedTeamModal.memberCount).toFixed(2) : '0.00')} pts
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Members</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {selectedTeamModal.memberCount || 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Team Rank</p>
                <p className="text-base sm:text-lg font-bold text-amber-700 mt-0.5 tabular-nums">
                  #{selectedTeamModal.rank || '—'}
                </p>
              </div>
            </div>

            {loadingTeamModal ? (
              <div className="py-8 space-y-3">
                <Skeleton className="h-4 w-48" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 border border-slate-100 rounded-lg flex justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : teamModalError ? (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center justify-between gap-3">
                <span>{teamModalError}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fetchTeamScoringDetails(selectedTeamModal.teamId || selectedTeamModal._id)}
                >
                  Retry
                </Button>
              </div>
            ) : (() => {
              const monthData = teamModalDetails?.month;
              const memberEntries = monthData?.memberEntries || [];
              const teamEntries = monthData?.teamEntries || [];

              const approvedMemberEntries = memberEntries.filter((e) => e.status === 'approved');
              const approvedTeamEntries = teamEntries.filter((e) => e.status === 'approved');
              const pendingCount =
                memberEntries.filter((e) => e.status === 'pending').length +
                teamEntries.filter((e) => e.status === 'pending').length;

              const totalContributingCount = approvedMemberEntries.length + approvedTeamEntries.length;
              const memberApprovedPts = approvedMemberEntries.reduce((sum, e) => sum + (e.points || 0), 0);
              const teamApprovedPts = approvedTeamEntries.reduce((sum, e) => sum + (e.points || 0), 0);
              const totalBreakdownPts = memberApprovedPts + teamApprovedPts;

              if (totalContributingCount === 0) {
                return (
                  <div className="py-6 text-center">
                    <EmptyState
                      icon={Trophy}
                      title="No approved scoring records"
                      description="No approved member activities or team awards have been logged for this team this month."
                    />
                    {pendingCount > 0 && (
                      <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2.5 rounded-lg inline-block">
                        Note: {pendingCount} pending submission{pendingCount === 1 ? '' : 's'} awaiting approval (not counted in current score).
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                    <span>Contributing Scoring Records ({totalContributingCount})</span>
                    <span>Points</span>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                    {/* Member activities */}
                    {approvedMemberEntries.map((entry) => {
                      const criteriaName =
                        entry.criteria?.name ||
                        (entry.adminAdjustmentReason ? `Manual Adjustment: ${entry.adminAdjustmentReason}` : '') ||
                        (entry.isReversal ? `Reversal: ${entry.reversalReason || 'Original entry reversed'}` : '') ||
                        'Activity';
                      const isNegative = (entry.points || 0) < 0;

                      return (
                        <div key={entry._id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">
                              {criteriaName}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-slate-500">
                              <span className="font-medium text-slate-700">
                                {entry.member?.name || 'Member'}
                              </span>
                              {entry.member?.username && (
                                <span className="font-mono text-slate-400">
                                  @{entry.member.username}
                                </span>
                              )}
                              <span>•</span>
                              <span>{formatDate(entry.date)}</span>
                              {entry.quantity > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium">Qty: {entry.quantity}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-bold tabular-nums px-2 py-0.5 rounded border text-xs ${
                              isNegative
                                ? 'text-rose-700 bg-rose-50 border-rose-100'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                            }`}
                          >
                            {entry.points > 0 ? `+${entry.points}` : entry.points} pts
                          </span>
                        </div>
                      );
                    })}

                    {/* Team bonus awards */}
                    {approvedTeamEntries.map((entry) => {
                      const criteriaName = entry.criteria?.name || 'Monthly Team Point Award';
                      const isNegative = (entry.points || 0) < 0;

                      return (
                        <div key={entry._id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs bg-brand-50/30 p-2 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-100 text-brand-800">
                                Team Award
                              </span>
                              <p className="font-semibold text-slate-900 truncate">
                                {criteriaName}
                              </p>
                            </div>
                            <p className="mt-0.5 text-slate-500">
                              {entry.submittedBy?.name ? `Submitted by ${entry.submittedBy.name} • ` : ''}
                              {formatDate(entry.createdAt || entry.date)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 font-bold tabular-nums px-2 py-0.5 rounded border text-xs ${
                              isNegative
                                ? 'text-rose-700 bg-rose-50 border-rose-100'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                            }`}
                          >
                            {entry.points > 0 ? `+${entry.points}` : entry.points} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reconciliation summary banner */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Reconciled Total: {totalBreakdownPts} pts
                        {teamApprovedPts > 0 ? ` (${memberApprovedPts} member + ${teamApprovedPts} team)` : ''}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">
                      Matches Dashboard Total ({(selectedTeamModal.total ?? selectedTeamModal.totalPoints ?? 0).toLocaleString()} pts)
                    </span>
                  </div>

                  {pendingCount > 0 && (
                    <p className="text-[11px] text-slate-400 text-center">
                      {pendingCount} pending submission{pendingCount === 1 ? '' : 's'} awaiting approval (not counted in total score)
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* 7. Member Scoring Details Modal */}
      <Modal
        isOpen={Boolean(selectedMemberModal)}
        onClose={handleCloseMemberModal}
        title={selectedMemberModal ? selectedMemberModal.name : 'Member Details'}
        subtitle={selectedMemberModal ? `${selectedMemberModal.team || 'Unassigned'} • @${selectedMemberModal.username || ''}` : 'Member Scoring Breakdown • This Month'}
        maxWidth="max-w-xl"
      >
        {selectedMemberModal && (
          <div className="space-y-4">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monthly Score</p>
                <p
                  className={`text-base sm:text-lg font-bold mt-0.5 tabular-nums ${
                    (selectedMemberModal.total ?? 0) < 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {(selectedMemberModal.total ?? 0) > 0 ? `+${selectedMemberModal.total}` : selectedMemberModal.total ?? 0} pts
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Team</p>
                <p className="text-sm sm:text-base font-bold text-brand-700 mt-0.5 truncate">
                  {selectedMemberModal.team || 'Unassigned'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Chapter Rank</p>
                <p className="text-base sm:text-lg font-bold text-amber-700 mt-0.5 tabular-nums">
                  #{selectedMemberModal.rank || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center sm:text-left">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Username</p>
                <p className="text-sm sm:text-base font-mono text-slate-700 mt-0.5 truncate">
                  @{selectedMemberModal.username || '—'}
                </p>
              </div>
            </div>

            {loadingMemberModal ? (
              <div className="py-8 space-y-3">
                <Skeleton className="h-4 w-48" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 border border-slate-100 rounded-lg flex justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : memberModalError ? (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center justify-between gap-3">
                <span>{memberModalError}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fetchMemberScoringDetails(selectedMemberModal.userId || selectedMemberModal._id)}
                >
                  Retry
                </Button>
              </div>
            ) : (() => {
              const monthData = memberModalDetails?.month;
              const memberEntries = monthData?.memberEntries || [];

              const approvedEntries = memberEntries.filter((e) => e.status === 'approved');
              const pendingCount = memberEntries.filter((e) => e.status === 'pending').length;
              const totalApprovedScore = approvedEntries.reduce((sum, e) => sum + (e.points || 0), 0);

              if (approvedEntries.length === 0) {
                return (
                  <div className="py-6 text-center">
                    <EmptyState
                      icon={Medal}
                      title="No approved scoring activities"
                      description="No approved activity points or penalties have been recorded for this member this month."
                    />
                    {pendingCount > 0 && (
                      <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2.5 rounded-lg inline-block">
                        Note: {pendingCount} pending submission{pendingCount === 1 ? '' : 's'} awaiting approval (not included in current score).
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                    <span>Contributing Activities & Penalties ({approvedEntries.length})</span>
                    <span>Points</span>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                    {approvedEntries.map((entry) => {
                      const criteriaName =
                        entry.criteria?.name ||
                        (entry.adminAdjustmentReason ? `Manual Adjustment: ${entry.adminAdjustmentReason}` : '') ||
                        (entry.isReversal ? `Reversal: ${entry.reversalReason || 'Original entry reversed'}` : '') ||
                        'Activity';
                      const isPenalty = (entry.points || 0) < 0 || entry.criteria?.category === 'penalty';
                      const categoryTag = isPenalty
                        ? 'Penalty'
                        : entry.criteria?.category === 'meeting_day'
                        ? 'Meeting Day'
                        : entry.criteria?.category === 'non_meeting_day'
                        ? 'Non-Meeting'
                        : 'Activity';

                      return (
                        <div key={entry._id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isPenalty
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {categoryTag}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">
                                {criteriaName}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-slate-500">
                              <span>{formatDate(entry.date)}</span>
                              {entry.quantity > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium text-slate-600">Qty: {entry.quantity}</span>
                                </>
                              )}
                              {entry.note && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 italic truncate max-w-[150px]">
                                    &ldquo;{entry.note}&rdquo;
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-bold tabular-nums px-2 py-0.5 rounded border text-xs ${
                              isPenalty
                                ? 'text-rose-700 bg-rose-50 border-rose-100'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                            }`}
                          >
                            {entry.points > 0 ? `+${entry.points}` : entry.points} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reconciliation summary banner */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Breakdown Total: {totalApprovedScore > 0 ? `+${totalApprovedScore}` : totalApprovedScore} pts
                      </span>
                    </div>
                    <span className="font-bold text-emerald-700">
                      Matches Dashboard Score ({(selectedMemberModal.total ?? 0) > 0 ? `+${selectedMemberModal.total}` : selectedMemberModal.total ?? 0} pts)
                    </span>
                  </div>

                  {pendingCount > 0 && (
                    <p className="text-[11px] text-slate-400 text-center">
                      {pendingCount} pending submission{pendingCount === 1 ? '' : 's'} awaiting approval (not counted in total score)
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;
