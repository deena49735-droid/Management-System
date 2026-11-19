import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Trophy, ChevronDown, ChevronUp, Search, Calendar, ChevronLeft, ChevronRight, Award } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import SearchBar from '../components/SearchBar';

const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

const getTodayString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const shiftDate = (currentDateStr, days) => {
  const parts = currentDateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatShortDate = (isoStr) => {
  if (!isoStr) return '';
  try {
    const parts = isoStr.split('T')[0].split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
};

const formatLongDate = (isoStr) => {
  if (!isoStr) return '';
  try {
    const parts = isoStr.split('T')[0].split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
};

const Leaderboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'members'

  // Period filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentWeek = getWeekNumber(now);

  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'all'
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');

  // Period details derived from selectedDate
  const periodDetails = useMemo(() => {
    let y, m, d;
    if (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate.trim())) {
      const parts = selectedDate.trim().split('-').map(Number);
      y = parts[0];
      m = parts[1];
      d = parts[2];
    } else {
      const today = new Date();
      y = today.getFullYear();
      m = today.getMonth() + 1;
      d = today.getDate();
    }
    const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const w = getWeekNumber(ref);
    const dayOfWeek = ref.getUTCDay() || 7;
    const startOfWeek = new Date(Date.UTC(y, m - 1, d - (dayOfWeek - 1), 0, 0, 0, 0));
    const endOfWeek = new Date(Date.UTC(y, m - 1, d + (7 - dayOfWeek), 23, 59, 59, 999));
    const startOfMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const endOfMonth = new Date(Date.UTC(y, m - 1, lastDayOfMonth, 23, 59, 59, 999));

    const monthName = ref.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

    return {
      year: y,
      month: m,
      day: d,
      week: w,
      startOfWeekStr: startOfWeek.toISOString().split('T')[0],
      endOfWeekStr: endOfWeek.toISOString().split('T')[0],
      startOfMonthStr: startOfMonth.toISOString().split('T')[0],
      endOfMonthStr: endOfMonth.toISOString().split('T')[0],
      monthName,
    };
  }, [selectedDate]);

  const handlePrevPeriod = () => {
    if (period === 'month') {
      const parts = selectedDate.split('-').map(Number);
      const prevMonth = new Date(Date.UTC(parts[0], parts[1] - 2, Math.min(parts[2], 28)));
      setSelectedDate(prevMonth.toISOString().split('T')[0]);
    } else {
      setSelectedDate((prev) => shiftDate(prev, -7));
    }
  };

  const handleNextPeriod = () => {
    if (period === 'month') {
      const parts = selectedDate.split('-').map(Number);
      const nextMonth = new Date(Date.UTC(parts[0], parts[1], Math.min(parts[2], 28)));
      setSelectedDate(nextMonth.toISOString().split('T')[0]);
    } else {
      setSelectedDate((prev) => shiftDate(prev, 7));
    }
  };

  const handleToday = () => {
    setSelectedDate(getTodayString());
  };

  // Data states
  const [teamLeaderboard, setTeamLeaderboard] = useState([]);
  const [memberLeaderboard, setMemberLeaderboard] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded team row IDs for breakdown
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Load team list for member filtering
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/teams/options');
        setAllTeams(res.data.data || []);
      } catch (err) {
        console.error('Failed to load teams for filter:', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch leaderboard data when filters change
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const params = { period };
        if (period !== 'all') {
          params.date = selectedDate;
          params.year = periodDetails.year;
          if (period === 'month') params.month = periodDetails.month;
          if (period === 'week') params.week = periodDetails.week;
        }

        if (activeTab === 'teams') {
          const res = await api.get('/leaderboard/teams', { params });
          setTeamLeaderboard(res.data.data || []);
        } else {
          if (selectedTeamFilter) params.team = selectedTeamFilter;
          const res = await api.get('/leaderboard/members', { params });
          setMemberLeaderboard(res.data.data || []);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load leaderboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab, period, selectedDate, selectedTeamFilter, periodDetails]);

  const currentList = activeTab === 'teams' ? teamLeaderboard : memberLeaderboard;

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.trim().toLowerCase();
    return currentList.filter((row) => {
      const name = (row.name || '').toLowerCase();
      const username = (row.username || '').toLowerCase();
      const team = (row.team || '').toLowerCase();
      return name.includes(q) || username.includes(q) || team.includes(q);
    });
  }, [currentList, searchQuery]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setExpandedTeamId(null);
  };

  // Top 3 entries for podium
  const topThree = useMemo(() => {
    return currentList.slice(0, 3);
  }, [currentList]);

  // Chart data for teams
  const chartData = useMemo(() => {
    return teamLeaderboard.map((t) => ({
      name: t.name,
      total: t.total,
      average: t.averageRounded ?? 0,
      memberCount: t.memberCount || 0,
      teamId: t.teamId,
    }));
  }, [teamLeaderboard]);

  const userTeamId = user?.team?._id || user?.team;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Rankings and scores"
        subtitle="Live standings for chapter teams and top-performing members."
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
            <button
              type="button"
              onClick={() => handleTabChange('teams')}
              className={`flex-1 sm:flex-initial min-h-[44px] rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'teams'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Teams leaderboard
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('members')}
              className={`flex-1 sm:flex-initial min-h-[44px] rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'members'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top members
            </button>
          </div>
        }
      />

      {/* Tidy Filters Toolbar with Date Picker & Navigation */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Quick Period Switcher & Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Period Buttons */}
            <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              {[
                { key: 'week', label: 'This week' },
                { key: 'month', label: 'This month' },
                { key: 'all', label: 'All time' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPeriod(p.key);
                    if (p.key !== 'all') {
                      setSelectedDate(getTodayString());
                    }
                  }}
                  className={`min-h-[38px] rounded-md px-3.5 text-xs font-semibold transition ${
                    period === p.key
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Picker & Controls (active for week/month, selecting date switches to week/month) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="leaderboard-date-picker"
                  className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Date:</span>
                </label>
                <input
                  id="leaderboard-date-picker"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      if (period === 'all') setPeriod('month');
                    }
                  }}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Prev / Today / Next Navigation */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevPeriod}
                  title={period === 'month' ? 'Previous month' : 'Previous week'}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  title="Reset to today"
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition border-x border-slate-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleNextPeriod}
                  title={period === 'month' ? 'Next month' : 'Next week'}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Team filter for members tab */}
          {activeTab === 'members' && (
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <label htmlFor="team-filter-select" className="text-xs font-semibold text-slate-700">Team:</label>
              <select
                id="team-filter-select"
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
              >
                <option value="">All teams</option>
                {allTeams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Period Display Banner */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-600">Active Period:</span>
            {period === 'week' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-brand-50 text-brand-700 border border-brand-200/70">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                Week {periodDetails.week} ({formatShortDate(periodDetails.startOfWeekStr)} – {formatShortDate(periodDetails.endOfWeekStr)})
              </span>
            )}
            {period === 'month' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                Month: {periodDetails.monthName} {periodDetails.year} ({formatShortDate(periodDetails.startOfMonthStr)} – {formatShortDate(periodDetails.endOfMonthStr)})
              </span>
            )}
            {period === 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
                <Trophy className="w-3.5 h-3.5 text-purple-600" />
                All-Time Cumulative Standings
              </span>
            )}
          </div>
          {period !== 'all' && (
            <span className="text-slate-500 font-medium text-[11px] sm:text-xs">
              Selected date: {formatLongDate(selectedDate)}
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={6} cols={activeTab === 'teams' ? 5 : 4} />
        </div>
      ) : currentList.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No standings recorded for this period"
          description="Scores and rankings will appear here once activities and points are approved."
        />
      ) : (
        <>
          {/* Top 3 Podium-style Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {topThree.map((item, idx) => {
                const isFirst = item.rank === 1;
                const isSecond = item.rank === 2;
                const isUserRow =
                  activeTab === 'members'
                    ? item.userId === user?._id
                    : item.teamId === userTeamId;

                return (
                  <div
                    key={`podium-${item.teamId || item.userId || idx}`}
                    className={`relative rounded-xl p-5 shadow-xs border transition ${
                      isFirst
                        ? 'border-amber-300 bg-gradient-to-b from-amber-50/70 to-white'
                        : isSecond
                        ? 'border-slate-300 bg-gradient-to-b from-slate-50/80 to-white'
                        : 'border-orange-200 bg-gradient-to-b from-orange-50/60 to-white'
                    } ${isUserRow ? 'ring-2 ring-brand-500 bg-brand-50/30' : ''}`}
                  >
                    {/* Rank Badge + Indicator */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold tabular-nums shadow-xs ${
                          isFirst
                            ? 'bg-amber-400 text-amber-950'
                            : isSecond
                            ? 'bg-slate-300 text-slate-900'
                            : 'bg-orange-300 text-orange-950'
                        }`}
                      >
                        #{item.rank}
                      </span>

                      {isUserRow && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                          {activeTab === 'members' ? 'You' : 'Your team'}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Avatar name={item.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {item.name}
                        </h3>
                        {activeTab === 'members' && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {item.team || 'Unassigned'}
                            {item.username ? ` • @${item.username}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          {activeTab === 'teams' ? 'Average / member' : 'Total score'}
                        </span>
                        <span
                          className={`text-lg font-bold tabular-nums ${
                            (activeTab === 'teams' ? (item.averageRounded ?? item.total) : item.total) < 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {activeTab === 'teams'
                            ? `${item.averageRounded != null ? item.averageRounded.toFixed(2) : '0.00'} pts`
                            : `${item.total > 0 ? `+${item.total}` : item.total} pts`}
                        </span>
                      </div>
                      {activeTab === 'teams' && (
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 border-t border-slate-50">
                          <span>
                            Total: <strong className="font-semibold text-slate-700">{item.total > 0 ? `+${item.total}` : item.total} pts</strong>
                          </span>
                          <span className="font-medium text-slate-600">{item.memberCount || 0} members</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recharts Bar Chart for Teams */}
          {activeTab === 'teams' && chartData.length > 0 && (
            <Card
              title="Team totals comparison"
              subtitle="Visual breakdown of total points per team"
            >
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={12}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                      formatter={(val, name, props) => [
                        `${val} total pts • Avg: ${props.payload.average} pts/member (${props.payload.memberCount} members)`,
                        'Score',
                      ]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={`cell-${entry.teamId}`}
                          fill={
                            entry.teamId === userTeamId
                              ? '#B91C1C' // brand-600 for user team
                              : entry.total >= 0
                              ? '#10b981' // emerald
                              : '#f43f5e' // rose
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Full Standings List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Full standings ({filteredList.length})
                </h2>
                {activeTab === 'teams' && (
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Click a team row to inspect breakdown
                  </span>
                )}
              </div>

              <div className="w-full sm:w-72">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={
                    activeTab === 'teams'
                      ? 'Search team name...'
                      : 'Search by name, username, or team...'
                  }
                />
              </div>
            </div>

            {filteredList.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No ${activeTab} match your search`}
                description={`No standings records found matching "${searchQuery}".`}
                actionLabel="Clear search"
                onAction={() => setSearchQuery('')}
              />
            ) : (
              <>
                {/* Mobile Cards View (Below 768px: each row is a clean card) */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {filteredList.map((row, idx) => {
                const isUserRow =
                  activeTab === 'members'
                    ? row.userId === user?._id
                    : row.teamId === userTeamId;
                const isExpanded = activeTab === 'teams' && expandedTeamId === row.teamId;

                return (
                  <div
                    key={`mobile-${row.teamId || row.userId || idx}`}
                    onClick={() => {
                      if (activeTab === 'teams') {
                        setExpandedTeamId(isExpanded ? null : row.teamId);
                      }
                    }}
                    className={`rounded-xl border p-4 shadow-2xs transition ${
                      isUserRow
                        ? 'border-brand-300 bg-brand-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold tabular-nums text-slate-700 shrink-0">
                          #{row.rank}
                        </span>
                        <Avatar name={row.name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {row.name}
                            </p>
                            {isUserRow && (
                              <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-xs font-bold text-white">
                                {activeTab === 'members' ? 'You' : 'Your team'}
                              </span>
                            )}
                          </div>
                          {activeTab === 'members' && (
                            <p className="text-xs text-slate-500 truncate">
                              {row.team || 'Unassigned'}
                              {row.username ? ` • @${row.username}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              (activeTab === 'teams' ? (row.averageRounded ?? row.total) : row.total) < 0
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {activeTab === 'teams'
                              ? `Avg: ${row.averageRounded != null ? row.averageRounded.toFixed(2) : '0.00'} pts`
                              : `${row.total > 0 ? `+${row.total}` : row.total} pts`}
                          </span>
                          {activeTab === 'teams' && (
                            <div className="text-slate-400">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          )}
                        </div>
                        {activeTab === 'teams' && (
                          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                            Total: {row.total > 0 ? `+${row.total}` : row.total} pts • {row.memberCount || 0} mbrs
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable breakdown for Teams on mobile */}
                    {activeTab === 'teams' && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs space-y-2 text-slate-600">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="block text-[11px] text-slate-400">Member pts:</span>
                            <span className="font-semibold tabular-nums text-emerald-700">+{row.memberPoints}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400">Team bonus:</span>
                            <span className="font-semibold tabular-nums text-brand-700">+{row.teamPoints}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400">Penalties:</span>
                            <span className="font-semibold tabular-nums text-rose-600">{row.penalties}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100/80 font-medium text-slate-700">
                          <span>Avg / member: <strong className="text-brand-700 font-bold tabular-nums">{row.averageRounded != null ? row.averageRounded.toFixed(2) : '0.00'} pts</strong></span>
                          <span className="text-slate-400">{row.total} ÷ {row.memberCount || 0} mbrs</span>
                        </div>
                      </div>
                    )}

                    {/* Members breakdown on mobile */}
                    {activeTab === 'members' && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs flex items-center justify-between text-slate-600">
                        <span>
                          Rewards: <strong className="tabular-nums text-emerald-700">+{row.rewards}</strong>
                        </span>
                        <span>
                          Penalties: <strong className="tabular-nums text-rose-600">{row.penalties}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center w-16">Rank</th>
                    <th className="px-5 py-3">{activeTab === 'teams' ? 'Team name' : 'Member name'}</th>
                    {activeTab === 'members' && <th className="px-5 py-3">Team</th>}
                    {activeTab === 'teams' && (
                      <>
                        <th className="px-3 py-3 text-center">Members</th>
                        <th className="px-4 py-3 text-right">Member pts</th>
                        <th className="px-4 py-3 text-right">Team bonus</th>
                        <th className="px-4 py-3 text-right">Penalties</th>
                        <th className="px-4 py-3 text-right">Total points</th>
                        <th className="px-5 py-3 text-right">Avg / member</th>
                      </>
                    )}
                    {activeTab === 'members' && (
                      <>
                        <th className="px-4 py-3 text-right">Rewards</th>
                        <th className="px-4 py-3 text-right">Penalties</th>
                        <th className="px-5 py-3 text-right">Total score</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((row, idx) => {
                    const isUserRow =
                      activeTab === 'members'
                        ? row.userId === user?._id
                        : row.teamId === userTeamId;
                    const isExpanded = activeTab === 'teams' && expandedTeamId === row.teamId;

                    return (
                      <React.Fragment key={`row-${row.teamId || row.userId || idx}`}>
                        <tr
                          onClick={() => {
                            if (activeTab === 'teams') {
                              setExpandedTeamId(isExpanded ? null : row.teamId);
                            }
                          }}
                          className={`transition ${
                            activeTab === 'teams' ? 'cursor-pointer' : ''
                          } ${
                            isUserRow
                              ? 'bg-brand-50/50 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
                                row.rank === 1
                                  ? 'bg-amber-100 text-amber-800'
                                  : row.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : row.rank === 3
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{row.rank}
                            </span>
                          </td>

                          <td className="px-5 py-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={row.name} size="xs" />
                              <span>{row.name}</span>
                              {activeTab === 'members' && row.username && (
                                <span className="text-xs font-normal text-slate-400">@{row.username}</span>
                              )}
                              {isUserRow && (
                                <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                                  {activeTab === 'members' ? 'You' : 'Your team'}
                                </span>
                              )}
                            </div>
                          </td>

                          {activeTab === 'members' && (
                            <td className="px-5 py-3 text-slate-600">{row.team || 'Unassigned'}</td>
                          )}

                          {activeTab === 'teams' && (
                            <>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tabular-nums">
                                  {row.memberCount || 0}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-semibold tabular-nums whitespace-nowrap">
                                +{row.memberPoints}
                              </td>
                              <td className="px-4 py-3 text-right text-brand-700 font-semibold tabular-nums whitespace-nowrap">
                                +{row.teamPoints}
                              </td>
                              <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums whitespace-nowrap">
                                {row.penalties}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-slate-800">
                                {row.total > 0 ? `+${row.total}` : row.total} pts
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold tabular-nums border ${
                                    (row.averageRounded ?? 0) < 0
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {row.averageRounded != null ? row.averageRounded.toFixed(2) : '0.00'} pts
                                </span>
                              </td>
                            </>
                          )}

                          {activeTab === 'members' && (
                            <>
                              <td className="px-4 py-3 text-right text-emerald-700 font-semibold tabular-nums whitespace-nowrap">
                                +{row.rewards}
                              </td>
                              <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums whitespace-nowrap">
                                {row.penalties}
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold tabular-nums border ${
                                    row.total < 0
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {row.total > 0 ? `+${row.total}` : row.total} pts
                                </span>
                              </td>
                            </>
                          )}
                        </tr>

                        {/* Expanded Breakdown for Team */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 text-xs">
                            <td colSpan={8} className="px-6 py-3 border-t border-slate-100">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <span className="font-semibold text-slate-700">
                                  Score breakdown for {row.name} ({row.memberCount || 0} eligible members):
                                </span>
                                <div className="flex flex-wrap items-center gap-6">
                                  <span>
                                    Member rewards:{' '}
                                    <strong className="text-emerald-700 tabular-nums">+{row.memberPoints}</strong>
                                  </span>
                                  <span>
                                    Team bonus:{' '}
                                    <strong className="text-brand-700 tabular-nums">+{row.teamPoints}</strong>
                                  </span>
                                  <span>
                                    Penalties:{' '}
                                    <strong className="text-rose-600 tabular-nums">{row.penalties}</strong>
                                  </span>
                                  <span>
                                    Total points:{' '}
                                    <strong className="text-slate-900 tabular-nums">{row.total} pts</strong>
                                  </span>
                                  <span>
                                    Average per member:{' '}
                                    <strong className="text-emerald-700 font-bold tabular-nums">
                                      {row.averageRounded != null ? row.averageRounded.toFixed(2) : '0.00'} pts/member
                                    </strong>{' '}
                                    <span className="text-slate-400">({row.total} ÷ {row.memberCount || 0})</span>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
