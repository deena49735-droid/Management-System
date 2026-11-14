import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
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
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamPointsMonth, setTeamPointsMonth] = useState(0);
  const [myRecentSubmissions, setMyRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssistantData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teamRes, entriesRes, leaderboardRes] = await Promise.all([
        api.get('/teams/my'),
        api.get('/entries'),
        api.get('/leaderboard/teams', { params: { period: 'month' } }),
      ]);

      const teamData = teamRes.data?.data;
      setTeam(teamData);

      const allEntries = entriesRes.data?.data || [];
      // Filter submissions entered by this assistant or for this team
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
          description="Your user account is not currently assigned as Assistant of any chapter team. Please contact your administrator."
        />
      </div>
    );
  }

  const memberCount =
    (team?.members?.length || 0) + (team?.head ? 1 : 0) + (team?.assistant ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={greeting}
        subtitle={`Team Assistant • Managing points and meetings for ${team?.name || 'Team'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={PlusCircle}
              onClick={() => navigate('/assistant/entries/new')}
            >
              Add Entry
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
        <StatCard
          label="My Pending Submissions"
          value={myPendingCount}
          icon={Clock}
          variant="amber"
          hint={myPendingCount > 0 ? 'Awaiting Team Head approval' : 'All entries approved'}
          hintType={myPendingCount > 0 ? 'warning' : 'neutral'}
          loading={loading}
        />
        <StatCard
          label="Team Rank"
          value={teamRank ? `#${teamRank}` : '—'}
          icon={Trophy}
          variant="brand"
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
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
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
    </div>
  );
};

export default AssistantOverview;
