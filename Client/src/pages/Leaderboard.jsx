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
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { Skeleton } from '../components/Skeleton';

const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
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
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedWeek, setSelectedWeek] = useState(currentWeek.toString());
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');

  // Data states
  const [teamLeaderboard, setTeamLeaderboard] = useState([]);
  const [memberLeaderboard, setMemberLeaderboard] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded team row IDs for breakdown
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  // Load team list for member filtering
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/teams');
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
          params.year = selectedYear;
          if (period === 'month') params.month = selectedMonth;
          if (period === 'week') params.week = selectedWeek;
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
  }, [activeTab, period, selectedYear, selectedMonth, selectedWeek, selectedTeamFilter]);

  const currentList = activeTab === 'teams' ? teamLeaderboard : memberLeaderboard;

  // Top 3 entries
  const topThree = useMemo(() => {
    return currentList.slice(0, 3);
  }, [currentList]);

  // Chart data for teams
  const chartData = useMemo(() => {
    return teamLeaderboard.map((t) => ({
      name: t.name,
      total: t.total,
      teamId: t.teamId,
    }));
  }, [teamLeaderboard]);

  const userTeamId = user?.team?._id || user?.team;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Rankings & Scores"
        subtitle="Live standings for chapter teams and top-performing members."
        actions={
          <div className="inline-flex rounded-lg bg-slate-200/80 p-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'teams'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Teams Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'members'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Top Members
            </button>
          </div>
        }
      />

      {/* Filters Card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Period Buttons */}
          <div className="flex items-center gap-1.5">
            {[
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'all', label: 'All Time' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key);
                  if (p.key === 'week') setSelectedWeek(currentWeek.toString());
                  if (p.key === 'month') setSelectedMonth(currentMonth.toString());
                  setSelectedYear(currentYear.toString());
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  period === p.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Granular Period Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {period === 'week' && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="h-9 min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Week {w} {w === currentWeek ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            )}

            {period === 'month' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}{' '}
                    {m === currentMonth ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            )}

            {period !== 'all' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-9 min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            )}

            {/* Members tab team filter */}
            {activeTab === 'members' && (
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="h-9 min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Teams</option>
                {allTeams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading standings...</p>
        </Card>
      ) : currentList.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-sm font-semibold text-slate-800">No scores recorded for this period.</p>
          <p className="text-xs text-slate-500 mt-1">Check back once activities and points are approved.</p>
        </Card>
      ) : (
        <>
          {/* Top 3 Highlighted Podium Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {topThree.map((item) => {
                const isFirst = item.rank === 1;
                const isSecond = item.rank === 2;
                const isUserRow =
                  activeTab === 'members'
                    ? item.userId === user?._id
                    : item.teamId === userTeamId;

                return (
                  <div
                    key={item.teamId || item.userId}
                    className={`relative rounded-xl p-5 shadow-xs border transition ${
                      isFirst
                        ? 'border-amber-300 bg-gradient-to-b from-amber-50/70 to-white'
                        : isSecond
                        ? 'border-slate-300 bg-gradient-to-b from-slate-50/80 to-white'
                        : 'border-orange-200 bg-gradient-to-b from-orange-50/60 to-white'
                    } ${isUserRow ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    {/* Rank Badge */}
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
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          {activeTab === 'members' ? 'You' : 'Your Team'}
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {item.name}
                        </h3>
                        {activeTab === 'members' && item.username && (
                          <span className="text-xs text-slate-400">@{item.username}</span>
                        )}
                      </div>
                      {activeTab === 'members' && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {item.team || 'Unassigned'}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs font-medium text-slate-500">Total Score</span>
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          item.total < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {item.total > 0 ? `+${item.total}` : item.total} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recharts Bar Chart for Teams */}
          {activeTab === 'teams' && chartData.length > 0 && (
            <Card>
              <Card.Header
                title="Team Totals Comparison"
                subtitle="Visual overview of standings"
              />
              <Card.Body>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={11}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(val) => [`${val} points`, 'Total']}
                      />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={`cell-${entry.teamId}`}
                            fill={
                              entry.teamId === userTeamId
                                ? '#4f46e5' // indigo for user team
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
              </Card.Body>
            </Card>
          )}

          {/* Full Standings List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-base font-semibold text-slate-800">
                Full Standings ({currentList.length})
              </h2>
              {activeTab === 'teams' && (
                <span className="text-xs text-slate-400">Click a team row to inspect breakdown</span>
              )}
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-2.5 md:hidden">
              {currentList.map((row) => {
                const isUserRow =
                  activeTab === 'members'
                    ? row.userId === user?._id
                    : row.teamId === userTeamId;
                const isExpanded = activeTab === 'teams' && expandedTeamId === row.teamId;

                return (
                  <div
                    key={row.teamId || row.userId}
                    onClick={() => {
                      if (activeTab === 'teams') {
                        setExpandedTeamId(isExpanded ? null : row.teamId);
                      }
                    }}
                    className={`rounded-xl border p-4 shadow-2xs transition ${
                      isUserRow
                        ? 'border-indigo-400 bg-indigo-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold tabular-nums text-slate-700">
                          #{row.rank}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900">
                              {row.name}
                            </p>
                            {activeTab === 'members' && row.username && (
                              <span className="text-xs text-slate-400">@{row.username}</span>
                            )}
                            {isUserRow && (
                              <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {activeTab === 'members' ? 'You' : 'Your Team'}
                              </span>
                            )}
                          </div>
                          {activeTab === 'members' && (
                            <p className="text-xs text-slate-500">{row.team}</p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-sm font-bold tabular-nums ${
                          row.total < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {row.total > 0 ? `+${row.total}` : row.total} pts
                      </span>
                    </div>

                    {/* Expandable breakdown for Teams on mobile */}
                    {activeTab === 'teams' && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs grid grid-cols-3 gap-2 text-slate-600">
                        <div>
                          <span className="block text-[11px] text-slate-400">Member:</span>
                          <span className="font-semibold tabular-nums text-emerald-700">+{row.memberPoints}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Team Bonus:</span>
                          <span className="font-semibold tabular-nums text-indigo-700">+{row.teamPoints}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Penalties:</span>
                          <span className="font-semibold tabular-nums text-rose-600">{row.penalties}</span>
                        </div>
                      </div>
                    )}

                    {/* Members breakdown */}
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center w-16">Rank</th>
                    <th className="px-5 py-3">{activeTab === 'teams' ? 'Team Name' : 'Member Name'}</th>
                    {activeTab === 'members' && <th className="px-5 py-3">Team</th>}
                    {activeTab === 'teams' && (
                      <>
                        <th className="px-4 py-3 text-right">Member Pts</th>
                        <th className="px-4 py-3 text-right">Team Bonus</th>
                        <th className="px-4 py-3 text-right">Penalties</th>
                      </>
                    )}
                    {activeTab === 'members' && (
                      <>
                        <th className="px-4 py-3 text-right">Rewards</th>
                        <th className="px-4 py-3 text-right">Penalties</th>
                      </>
                    )}
                    <th className="px-5 py-3 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentList.map((row) => {
                    const isUserRow =
                      activeTab === 'members'
                        ? row.userId === user?._id
                        : row.teamId === userTeamId;
                    const isExpanded = activeTab === 'teams' && expandedTeamId === row.teamId;

                    return (
                      <React.Fragment key={row.teamId || row.userId}>
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
                              ? 'bg-indigo-50/50 font-medium'
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
                            <div className="flex items-center gap-2">
                              <span>{row.name}</span>
                              {activeTab === 'members' && row.username && (
                                <span className="text-xs font-normal text-slate-400">@{row.username}</span>
                              )}
                              {isUserRow && (
                                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                                  {activeTab === 'members' ? 'You' : 'Your Team'}
                                </span>
                              )}
                            </div>
                          </td>

                          {activeTab === 'members' && (
                            <td className="px-5 py-3 text-slate-600">{row.team}</td>
                          )}

                          {activeTab === 'teams' && (
                            <>
                              <td className="px-4 py-3 text-right text-emerald-700 font-semibold tabular-nums whitespace-nowrap">
                                +{row.memberPoints}
                              </td>
                              <td className="px-4 py-3 text-right text-indigo-700 font-semibold tabular-nums whitespace-nowrap">
                                +{row.teamPoints}
                              </td>
                              <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums whitespace-nowrap">
                                {row.penalties}
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
                            </>
                          )}

                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums border ${
                                row.total < 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {row.total > 0 ? `+${row.total}` : row.total} pts
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Breakdown for Team */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 text-xs">
                            <td colSpan={6} className="px-6 py-3 border-t border-slate-100">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <span className="font-semibold text-slate-700">
                                  Score Breakdown for {row.name}:
                                </span>
                                <div className="flex items-center gap-6">
                                  <span>
                                    Member Activity Rewards:{' '}
                                    <strong className="text-emerald-700 tabular-nums">+{row.memberPoints}</strong>
                                  </span>
                                  <span>
                                    Team Monthly / One-Time Bonus:{' '}
                                    <strong className="text-indigo-700 tabular-nums">+{row.teamPoints}</strong>
                                  </span>
                                  <span>
                                    Penalty Deductions:{' '}
                                    <strong className="text-rose-600 tabular-nums">{row.penalties}</strong>
                                  </span>
                                  <span>
                                    Final Net Score:{' '}
                                    <strong className="text-slate-900 tabular-nums">{row.total} pts</strong>
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
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
