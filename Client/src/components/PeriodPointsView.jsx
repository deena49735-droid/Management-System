import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Shield, Award, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from './Card';
import Badge from './Badge';
import ProofImage from './ProofImage';
import Button from './Button';

// Format YYYY-MM-DD to readable date (e.g., Nov 18, 2026)
const formatShortDate = (isoStr) => {
  if (!isoStr) return 'N/A';
  try {
    const parts = isoStr.split('T')[0].split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
};

// Format readable long date (e.g., Wednesday, November 18, 2026)
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

// Shift date by N days
const shiftDate = (currentDateStr, days) => {
  const parts = currentDateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTodayString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PeriodPointsView = ({ isAdmin = false }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayString);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Sub-tab for monthly view ('member' | 'team')
  const [monthlyTab, setMonthlyTab] = useState('member');

  // Load teams for admin filter dropdown
  useEffect(() => {
    if (isAdmin) {
      const loadTeams = async () => {
        try {
          const res = await api.get('/teams');
          setTeams(res.data.data || []);
        } catch (err) {
          console.error('Failed to load teams for filter:', err);
        }
      };
      loadTeams();
    }
  }, [isAdmin]);

  // Fetch period points data
  const fetchPeriodData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { date: selectedDate };
      if (isAdmin && selectedTeam) {
        params.team = selectedTeam;
      }
      const res = await api.get('/entries/by-period', { params });
      setData(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load points for the selected date.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTeam, isAdmin]);

  useEffect(() => {
    fetchPeriodData();
  }, [fetchPeriodData]);

  const handlePrevWeek = () => {
    setSelectedDate((prev) => shiftDate(prev, -7));
  };

  const handleNextWeek = () => {
    setSelectedDate((prev) => shiftDate(prev, 7));
  };

  const handleToday = () => {
    setSelectedDate(getTodayString());
  };

  return (
    <div className="space-y-6">
      {/* Date Picker & Controls Bar */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-brand-50/20 border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Date Selection Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="period-date-picker" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Select Date:</span>
              </label>
              <input
                id="period-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevWeek}
                title="Go back 1 week"
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-brand-600 hover:bg-slate-50 transition border-x border-slate-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                title="Go forward 1 week"
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Team Filter for Admin */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Team:</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Quick Refresh */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-xs font-medium text-slate-500">
              {formatLongDate(selectedDate)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={fetchPeriodData}
              isLoading={loading}
              title="Refresh period points"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Selected Period Information Banner */}
        {data && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Active Periods:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-brand-50 text-brand-700 border border-brand-200/70">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              Week {data.week.weekNumber} ({formatShortDate(data.week.startDate)} – {formatShortDate(data.week.endDate)})
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              Month: {data.month.monthName} {data.month.year}
            </span>
            {!isAdmin && user?.team && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 ml-auto">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                Team Scoped
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="danger" size="xs" onClick={fetchPeriodData}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6">
          <Card className="p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" />
              <p className="text-xs font-medium text-slate-500">Calculating weekly and monthly points for period...</p>
            </div>
          </Card>
        </div>
      )}

      {/* Main Content: Both Weekly & Monthly Sections */}
      {data && (
        <div className="space-y-8">
          {/* ======================================================== */}
          {/* SECTION 1: WEEKLY POINTS                                 */}
          {/* ======================================================== */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Weekly Points — Week {data.week.weekNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Entries recorded between {formatShortDate(data.week.startDate)} and {formatShortDate(data.week.endDate)}
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-500 self-start sm:self-auto">
                Official totals reflect approved points only
              </span>
            </div>

            {/* Weekly Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 bg-emerald-50/40 border-emerald-200/80">
                <span className="block text-xs font-semibold text-emerald-800 mb-1">Approved Weekly Total</span>
                <span className="text-2xl font-black text-emerald-700 tracking-tight">
                  {data.week.summary.approvedPoints > 0 ? `+${data.week.summary.approvedPoints}` : data.week.summary.approvedPoints} pts
                </span>
                <span className="block text-[11px] text-emerald-600/90 mt-1 font-medium">Contributes to scoreboard</span>
              </Card>

              <Card className="p-4 bg-amber-50/40 border-amber-200/80">
                <span className="block text-xs font-semibold text-amber-800 mb-1">Pending Weekly Review</span>
                <span className="text-2xl font-black text-amber-700 tracking-tight">
                  {data.week.summary.pendingPoints} pts
                </span>
                <span className="block text-[11px] text-amber-600/90 mt-1 font-medium">Awaiting approval</span>
              </Card>

              <Card className="p-4 bg-slate-50 border-slate-200">
                <span className="block text-xs font-semibold text-slate-700 mb-1">Total Weekly Entries</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight">
                  {data.week.summary.totalEntries}
                </span>
                <span className="block text-[11px] text-slate-500 mt-1 font-medium">Recorded activities</span>
              </Card>
            </div>

            {/* Weekly Entries Table / List */}
            {data.week.entries.length === 0 ? (
              <Card className="p-8 text-center bg-slate-50/50">
                <div className="max-w-xs mx-auto text-center space-y-1">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No Weekly Entries Found</p>
                  <p className="text-xs text-slate-500">
                    No member activity points were recorded during Week {data.week.weekNumber}.
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Team</th>
                        <th className="py-3 px-4">Criterion</th>
                        <th className="py-3 px-4 text-center">Points</th>
                        <th className="py-3 px-4 text-center">Proof</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.week.entries.map((entry) => {
                        const isNeg = (entry.points || 0) < 0;
                        return (
                          <tr key={entry._id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                              {formatShortDate(entry.date)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-900 block">{entry.member?.name || 'Unknown'}</span>
                              <span className="text-[11px] text-slate-400">@{entry.member?.username || entry.member?.phone || ''}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                              {entry.team?.name || 'N/A'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-800 block">{entry.criteria?.name || 'Activity'}</span>
                              <span className="text-[11px] text-slate-400 capitalize">{entry.criteria?.category || 'general'}</span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold border ${
                                  isNeg
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {isNeg ? entry.points : `+${entry.points}`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <Badge status={entry.status} size="xs" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden divide-y divide-slate-100">
                  {data.week.entries.map((entry) => {
                    const isNeg = (entry.points || 0) < 0;
                    return (
                      <div key={entry._id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{entry.member?.name || 'Unknown'}</span>
                            <span className="text-[11px] text-slate-500">{entry.criteria?.name}</span>
                          </div>
                          <Badge status={entry.status} size="xs" />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500 font-medium">
                            {formatShortDate(entry.date)} • {entry.team?.name || 'Team'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                isNeg ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isNeg ? entry.points : `+${entry.points}`}
                            </span>
                            <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: MONTHLY POINTS                                */}
          {/* ======================================================== */}
          <div className="space-y-3.5 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Monthly Points — {data.month.monthName} {data.month.year}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All member activities and team points credited for {data.month.monthName} {data.month.year}
                </p>
              </div>

              {/* Sub-tab switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMonthlyTab('member')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    monthlyTab === 'member'
                      ? 'bg-white text-brand-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Member ({data.month.memberEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyTab('team')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    monthlyTab === 'team'
                      ? 'bg-white text-brand-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Team Points ({data.month.teamEntries.length})
                </button>
              </div>
            </div>

            {/* Monthly Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 bg-emerald-50/40 border-emerald-200/80">
                <span className="block text-xs font-semibold text-emerald-800 mb-1">Approved Monthly Total</span>
                <span className="text-2xl font-black text-emerald-700 tracking-tight">
                  {data.month.summary.approvedPoints > 0 ? `+${data.month.summary.approvedPoints}` : data.month.summary.approvedPoints} pts
                </span>
                <span className="block text-[11px] text-emerald-700/90 mt-1 font-medium">
                  Member: +{data.month.summary.memberApprovedPoints} • Team: +{data.month.summary.teamApprovedPoints}
                </span>
              </Card>

              <Card className="p-4 bg-amber-50/40 border-amber-200/80">
                <span className="block text-xs font-semibold text-amber-800 mb-1">Pending Monthly Review</span>
                <span className="text-2xl font-black text-amber-700 tracking-tight">
                  {data.month.summary.pendingPoints} pts
                </span>
                <span className="block text-[11px] text-amber-600/90 mt-1 font-medium">Awaiting approval</span>
              </Card>

              <Card className="p-4 bg-slate-50 border-slate-200">
                <span className="block text-xs font-semibold text-slate-700 mb-1">Total Monthly Entries</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight">
                  {data.month.summary.totalEntries}
                </span>
                <span className="block text-[11px] text-slate-500 mt-1 font-medium">
                  {data.month.memberEntries.length} member + {data.month.teamEntries.length} team
                </span>
              </Card>
            </div>

            {/* Monthly Entries View */}
            {monthlyTab === 'member' ? (
              data.month.memberEntries.length === 0 ? (
                <Card className="p-8 text-center bg-slate-50/50">
                  <div className="max-w-xs mx-auto text-center space-y-1">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Member Entries This Month</p>
                    <p className="text-xs text-slate-500">
                      No member activity points have been recorded for {data.month.monthName} {data.month.year}.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Member</th>
                          <th className="py-3 px-4">Team</th>
                          <th className="py-3 px-4">Criterion</th>
                          <th className="py-3 px-4 text-center">Points</th>
                          <th className="py-3 px-4 text-center">Proof</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.month.memberEntries.map((entry) => {
                          const isNeg = (entry.points || 0) < 0;
                          return (
                            <tr key={entry._id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                                {formatShortDate(entry.date)}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-900 block">{entry.member?.name || 'Unknown'}</span>
                                <span className="text-[11px] text-slate-400">@{entry.member?.username || entry.member?.phone || ''}</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                                {entry.team?.name || 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-800 block">{entry.criteria?.name || 'Activity'}</span>
                                <span className="text-[11px] text-slate-400 capitalize">{entry.criteria?.category || 'general'}</span>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold border ${
                                    isNeg
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {isNeg ? entry.points : `+${entry.points}`}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <Badge status={entry.status} size="xs" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {data.month.memberEntries.map((entry) => {
                      const isNeg = (entry.points || 0) < 0;
                      return (
                        <div key={entry._id} className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{entry.member?.name || 'Unknown'}</span>
                              <span className="text-[11px] text-slate-500">{entry.criteria?.name}</span>
                            </div>
                            <Badge status={entry.status} size="xs" />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">
                              {formatShortDate(entry.date)} • {entry.team?.name || 'Team'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  isNeg ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {isNeg ? entry.points : `+${entry.points}`}
                              </span>
                              <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )
            ) : (
              data.month.teamEntries.length === 0 ? (
                <Card className="p-8 text-center bg-slate-50/50">
                  <div className="max-w-xs mx-auto text-center space-y-1">
                    <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Team Points This Month</p>
                    <p className="text-xs text-slate-500">
                      No monthly team criteria points have been recorded for {data.month.monthName} {data.month.year}.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Team</th>
                          <th className="py-3 px-4">Criteria</th>
                          <th className="py-3 px-4">Period</th>
                          <th className="py-3 px-4 text-center">Points</th>
                          <th className="py-3 px-4 text-center">Proof</th>
                          <th className="py-3 px-4">Submitted By</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.month.teamEntries.map((entry) => {
                          const isNeg = (entry.points || 0) < 0;
                          return (
                            <tr key={entry._id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                                {entry.team?.name || 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-800 block">{entry.criteria?.name || 'Team Point'}</span>
                                <span className="text-[11px] text-slate-400 capitalize">{entry.frequency || 'monthly'}</span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                                {data.month.monthName} {entry.year}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold border ${
                                    isNeg
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {isNeg ? entry.points : `+${entry.points}`}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                {entry.submittedBy?.name || 'System'}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <Badge status={entry.status} size="xs" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {data.month.teamEntries.map((entry) => {
                      const isNeg = (entry.points || 0) < 0;
                      return (
                        <div key={entry._id} className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{entry.team?.name}</span>
                              <span className="text-[11px] text-slate-500">{entry.criteria?.name}</span>
                            </div>
                            <Badge status={entry.status} size="xs" />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">
                              {data.month.monthName} {entry.year} • By {entry.submittedBy?.name || 'System'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  isNeg ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {isNeg ? entry.points : `+${entry.points}`}
                              </span>
                              <ProofImage src={entry.proofImage} alt={entry.criteria?.name} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodPointsView;
