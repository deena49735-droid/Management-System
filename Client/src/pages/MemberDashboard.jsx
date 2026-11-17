import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Award,
  Calendar,
  Medal,
  Plus,
  RefreshCw,
  Trophy,
  ArrowRight,
  ShieldAlert,
  Check,
  ChevronDown,
  Search,
  Camera,
  Sparkles,
  X,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import EntriesTable from '../components/EntriesTable';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import ProofUpload from '../components/ProofUpload';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Input from '../components/Input';
import { SkeletonCard, Skeleton } from '../components/Skeleton';

const PAGE_SIZE = 15;

const CATEGORY_ORDER = ['meeting_day', 'non_meeting_day'];
const CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities',
  non_meeting_day: 'Non-Meeting Day Activities',
};

const allowsMultipleQuantity = (basisLabel = '') => {
  if (!basisLabel) return false;
  return /Per Visitor|Per Testimonial|Per Specific Ask|Per Week/i.test(basisLabel);
};

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const MemberDashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    approvedTotal: 0,
    weekTotal: 0,
    penaltyTotal: 0,
    pendingCount: 0,
    rejectedCount: 0,
  });
  const [entries, setEntries] = useState([]);
  const [criteriaList, setCriteriaList] = useState([]);
  const [memberRank, setMemberRank] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [topMembers, setTopMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Breakdown Card State
  const [breakdownPeriod, setBreakdownPeriod] = useState('month');
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

  // Submit Modal State
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('all');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [entryNote, setEntryNote] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [proofPublicId, setProofPublicId] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, entriesRes, structureRes, teamLeaderboardRes, memberLeaderboardRes] =
        await Promise.all([
          api.get('/entries/my-summary'),
          api.get('/entries', { params: statusFilter ? { status: statusFilter } : {} }),
          api.get('/criteria/structure'),
          api.get('/leaderboard/teams', { params: { period: 'month' } }),
          api.get('/leaderboard/members', { params: { period: 'month' } }),
        ]);

      setSummary(summaryRes.data.data || {});
      setEntries(entriesRes.data.data || []);

      // Extract member activities (meeting_day & non_meeting_day only; penalties are excluded for members)
      const allowedCategories = (structureRes.data.data || []).filter(
        (c) => c.key === 'meeting_day' || c.key === 'non_meeting_day'
      );
      const flattened = [];
      allowedCategories.forEach((cat) => {
        (cat.items || []).forEach((item) => {
          if (item.isActive && Number(item.points) > 0) {
            flattened.push({
              ...item,
              categoryKey: cat.key,
              categoryLabel: cat.label,
            });
          }
        });
      });
      setCriteriaList(flattened);

      // Extract ranks
      const teamsList = teamLeaderboardRes.data.data || [];
      setTotalTeams(teamsList.length);
      const userTeamId = user?.team?._id || user?.team;
      const myTeam = teamsList.find((t) => t.teamId === userTeamId);
      if (myTeam) setTeamRank(myTeam.rank);

      const membersList = memberLeaderboardRes.data.data || [];
      setTotalMembers(membersList.length);
      setTopMembers(membersList.slice(0, 5));
      const me = membersList.find((m) => m.userId === user?._id);
      if (me) setMemberRank(me.rank);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load member dashboard.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakdown = async () => {
    try {
      setBreakdownLoading(true);
      const res = await api.get('/entries/my-breakdown', {
        params: { period: breakdownPeriod },
      });
      setBreakdownData(res.data.data);
    } catch (err) {
      console.error('Failed to load breakdown:', err);
    } finally {
      setBreakdownLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [statusFilter]);

  useEffect(() => {
    fetchBreakdown();
  }, [breakdownPeriod]);

  const selectedCriterion = criteriaList.find((c) => (c.id || c._id) === selectedCriteriaId);
  const showQuantity = selectedCriterion && allowsMultipleQuantity(selectedCriterion.basisLabel);
  const previewPoints = selectedCriterion
    ? selectedCriterion.points * (showQuantity ? Number(quantity) || 1 : 1)
    : 0;

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!selectedCriteriaId) {
      toast.error('Please select an activity.');
      return;
    }

    if (selectedCriterion?.needsProof && !proofImage) {
      const msg = `Photo proof is required for "${selectedCriterion.name}". Please upload a proof photo.`;
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/entries', {
        member: user._id,
        criteria: selectedCriteriaId,
        quantity: showQuantity ? Number(quantity) || 1 : 1,
        date: entryDate,
        note: entryNote ? entryNote.trim() : undefined,
        proofImage: proofImage || undefined,
        proofPublicId: proofPublicId || undefined,
      });

      toast.success('Activity submitted! Awaiting Team Head approval.');
      setIsSubmitOpen(false);
      setIsSelectorOpen(false);
      setSelectedCriteriaId('');
      setQuantity(1);
      setEntryNote('');
      setProofImage('');
      setProofPublicId('');
      setActivitySearch('');
      setSelectedCategoryTab('all');
      fetchDashboardData();
      fetchBreakdown();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit activity.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSubmitModal = () => {
    setIsSubmitOpen(false);
    setIsSelectorOpen(false);
    setActivitySearch('');
    setSubmitError('');
  };

  const totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  // Filtered criteria for the integrated selector
  const filteredModalCriteria = useMemo(() => {
    let list = criteriaList;
    if (selectedCategoryTab !== 'all') {
      list = list.filter((c) => c.categoryKey === selectedCategoryTab);
    }
    if (activitySearch.trim()) {
      const q = activitySearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.basisLabel && c.basisLabel.toLowerCase().includes(q)) ||
          (c.categoryLabel && c.categoryLabel.toLowerCase().includes(q))
      );
    }
    return list;
  }, [criteriaList, selectedCategoryTab, activitySearch]);

  // Grouped filtered criteria in official order
  const groupedModalCriteria = useMemo(() => {
    return CATEGORY_ORDER.reduce((acc, catKey) => {
      const items = filteredModalCriteria.filter((c) => c.categoryKey === catKey);
      if (items.length > 0) acc[catKey] = items;
      return acc;
    }, {});
  }, [filteredModalCriteria]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${getGreeting()}, ${user?.name || 'Member'}`}
        subtitle={`Member · Team: ${user?.team?.name || 'Unassigned'}`}
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setSubmitError('');
              setProofImage('');
              setProofPublicId('');
              setSelectedCriteriaId('');
              setQuantity(1);
              setEntryNote('');
              setActivitySearch('');
              setSelectedCategoryTab('all');
              setIsSelectorOpen(true);
              setIsSubmitOpen(true);
            }}
          >
            Submit activity
          </Button>
        }
      />

      {/* Error state */}
      {error && !loading && (
        <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={fetchDashboardData}
            className="mt-3"
          >
            Retry
          </Button>
        </Card>
      )}

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total points"
            value={summary.approvedTotal ?? 0}
            icon={Award}
            tint="emerald"
            hint="Lifetime approved points"
          />
          <StatCard
            label="This week"
            value={summary.weekTotal ?? 0}
            icon={Calendar}
            tint="brand"
            hint="Approved points this week"
          />
          <StatCard
            label="Penalties"
            value={summary.penaltyTotal ?? 0}
            icon={ShieldAlert}
            tint="rose"
            hint="Negative deductions"
          />
          <StatCard
            label="My rank"
            value={memberRank !== null ? `#${memberRank}` : '—'}
            icon={Medal}
            tint="amber"
            hint={totalMembers ? `of ${totalMembers} members this month` : 'This month'}
          />
        </div>
      )}

      {/* Points by Category Card */}
      <Card
        title="Points by category"
        subtitle="Performance breakdown comparing earned points against available targets."
        action={
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setBreakdownPeriod('week')}
              className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold text-center transition ${
                breakdownPeriod === 'week'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setBreakdownPeriod('month')}
              className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold text-center transition ${
                breakdownPeriod === 'month'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This month
            </button>
          </div>
        }
      >
        {breakdownLoading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading breakdown...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {breakdownData?.categories?.map((cat) => {
              const percent = Math.min(
                100,
                Math.round(((cat.earned || 0) / (cat.total || 1)) * 100)
              );

              return (
                <div key={cat.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 truncate max-w-[200px]" title={cat.label}>
                      {cat.label}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold tabular-nums text-slate-900 shrink-0">
                      <span className="text-brand-600 font-bold">{cat.earned || 0}</span> / {cat.total} pts
                    </span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium tabular-nums pt-0.5">
                    <span className="text-[11px] text-slate-400">Target progress</span>
                    <span className="font-semibold text-slate-700">{percent}% completed</span>
                  </div>
                </div>
              );
            })}

            {/* Penalties item shown separately */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 sm:p-4 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  Penalties
                </span>
                <span className="text-sm sm:text-base font-bold tabular-nums text-rose-600 shrink-0">
                  {breakdownData?.penalties?.earned || 0} pts
                </span>
              </div>
              <p className="text-xs text-rose-700/80 leading-relaxed">
                Total deductions incurred for {breakdownPeriod === 'week' ? 'this week' : 'this month'}.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Main Grid: Entries Table (2 cols) & Top 5 Leaderboard Preview (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Entries */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="My activity entries"
            subtitle="Track and review your submitted point logs"
            action={
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {[
                  { key: '', label: 'All' },
                  { key: 'approved', label: 'Approved' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'rejected', label: 'Rejected' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => {
                      setStatusFilter(st.key);
                      setCurrentPage(1);
                    }}
                    className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[32px] md:h-8 rounded-lg px-2.5 text-xs font-semibold text-center transition ${
                      statusFilter === st.key
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            }
            className="overflow-hidden p-0"
            footer={
              totalPages > 1 ? (
                <div className="flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={entries.length}
                    onPageChange={setCurrentPage}
                  />
                </div>
              ) : null
            }
          >
            <EntriesTable
              entries={paginatedEntries}
              loading={loading}
              showMember={false}
              emptyMessage="You have no point entries matching this filter."
            />
          </Card>
        </div>

        {/* Top 5 Leaderboard Preview */}
        <div className="space-y-4">
          <Card
            title="Top 5 leaderboard"
            subtitle="Current month standings"
            action={
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <span>Full view</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            className="overflow-hidden p-0"
            footer={
              <Link
                to="/leaderboard"
                className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-slate-700 hover:text-brand-600 transition py-1"
              >
                <span>View full leaderboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : topMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No member activity logged this month yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topMembers.map((member) => {
                  const isCurrentUser = member.userId === user?._id;
                  return (
                    <div
                      key={member.userId}
                      className={`flex items-center justify-between px-4 py-3 text-sm transition ${
                        isCurrentUser ? 'bg-brand-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums shrink-0 ${
                            member.rank === 1
                              ? 'bg-amber-100 text-amber-800'
                              : member.rank === 2
                              ? 'bg-slate-200 text-slate-700'
                              : member.rank === 3
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'text-slate-500'
                          }`}
                        >
                          {member.rank}
                        </span>
                        <Avatar name={member.name} size="xs" />
                        <div className="min-w-0 truncate">
                          <p className="truncate text-slate-900 text-sm">
                            {member.name}{' '}
                            {isCurrentUser && (
                              <span className="ml-1 text-xs font-bold text-brand-600">(You)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-400">{member.team || member.teamName || '—'}</p>
                        </div>
                      </div>
                      <div className="text-right pl-3 shrink-0">
                        <span className="font-semibold tabular-nums text-slate-900">
                          {member.total ?? member.points ?? 0}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Submit Activity Modal */}
      <Modal
        isOpen={isSubmitOpen}
        onClose={handleCloseSubmitModal}
        title="Submit activity for verification"
        subtitle="Submit earned activity points to your Team Head"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          {submitError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {submitError}
            </div>
          )}

          {/* Integrated Activity Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity criteria <span className="text-rose-500">*</span>
            </label>

            {/* Selected Activity Display Card */}
            {selectedCriterion ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {selectedCriterion.categoryLabel || CATEGORY_LABELS[selectedCriterion.categoryKey] || 'Activity'}
                      </span>
                      {selectedCriterion.needsProof ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Camera className="w-3 h-3 text-amber-600 shrink-0" />
                          Proof photo required
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                          Proof optional
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {selectedCriterion.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 tabular-nums">
                        +{selectedCriterion.points} pts
                      </span>
                      <span className="text-slate-500 font-medium">
                        Basis: {selectedCriterion.basisLabel || 'Per Member'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSelectorOpen((prev) => !prev)}
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition min-h-[36px]"
                    aria-expanded={isSelectorOpen}
                  >
                    <span>{isSelectorOpen ? 'Close list' : 'Change'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            ) : (
              /* Unselected Trigger Button */
              <button
                type="button"
                onClick={() => setIsSelectorOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition min-h-[44px] ${
                  isSelectorOpen
                    ? 'border-brand-500 ring-2 ring-brand-100 bg-white'
                    : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
                }`}
                aria-expanded={isSelectorOpen}
              >
                <span className="flex items-center gap-2 text-sm text-slate-500 font-medium truncate">
                  <Sparkles className="h-4 w-4 text-brand-500 shrink-0" />
                  Select an activity from the list...
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isSelectorOpen ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Integrated In-Flow Activities List Panel */}
            {isSelectorOpen && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3 space-y-2.5 transition-all duration-150">
                {/* Search & Filter Header */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      placeholder="Search by activity name..."
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100"
                      autoFocus
                    />
                    {activitySearch && (
                      <button
                        type="button"
                        onClick={() => setActivitySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category filter tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryTab('all')}
                      className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap min-h-[30px] ${
                        selectedCategoryTab === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All ({criteriaList.length})
                    </button>
                    {CATEGORY_ORDER.map((catKey) => {
                      const count = criteriaList.filter((c) => c.categoryKey === catKey).length;
                      if (!count) return null;
                      const isTabActive = selectedCategoryTab === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setSelectedCategoryTab(catKey)}
                          className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap min-h-[30px] ${
                            isTabActive
                              ? 'bg-brand-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {catKey === 'meeting_day' ? 'Meeting Day' : 'Non-Meeting'} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Internal Scrollable Activities List */}
                <div className="max-h-56 sm:max-h-64 overflow-y-auto space-y-3 pr-1 overscroll-contain">
                  {Object.keys(groupedModalCriteria).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
                      No matching activities found for &ldquo;{activitySearch}&rdquo;
                    </div>
                  ) : (
                    CATEGORY_ORDER.map((catKey) => {
                      const items = groupedModalCriteria[catKey];
                      if (!items || items.length === 0) return null;
                      return (
                        <div key={catKey} className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                            {CATEGORY_LABELS[catKey] || catKey}
                          </p>
                          <div className="space-y-1.5">
                            {items.map((c) => {
                              const isSelected = (c.id || c._id) === selectedCriteriaId;
                              return (
                                <button
                                  key={c.id || c._id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCriteriaId(c.id || c._id);
                                    setQuantity(1);
                                    setIsSelectorOpen(false);
                                    setActivitySearch('');
                                    setSubmitError('');
                                  }}
                                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2.5 min-h-[44px] ${
                                    isSelected
                                      ? 'bg-brand-50 border-brand-400 ring-2 ring-brand-200 text-brand-900 shadow-2xs'
                                      : 'bg-white border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 text-slate-800'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs sm:text-sm font-semibold leading-snug break-words">
                                        {c.name}
                                      </span>
                                      {c.needsProof && (
                                        <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                          Proof req.
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Basis: {c.basisLabel || 'Per Member'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-2 py-0.5 rounded text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 tabular-nums">
                                      +{c.points} pts
                                    </span>
                                    {isSelected && (
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shrink-0">
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quantity Field */}
          {showQuantity && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
              <Input
                label={`Quantity (${selectedCriterion?.basisLabel})`}
                type="number"
                min="1"
                max="50"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                helperText={`Calculated as ${selectedCriterion.points} points × ${Number(quantity) || 1} units.`}
              />
            </div>
          )}

          {/* Points Live Preview */}
          {selectedCriterion && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
              <span className="text-xs font-semibold text-slate-600">Points preview:</span>
              <span className="text-base font-bold tabular-nums text-emerald-700">+{previewPoints} pts</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          {/* Photo Proof Upload */}
          <ProofUpload
            value={proofImage}
            onChange={({ url, publicId }) => {
              setProofImage(url);
              setProofPublicId(publicId);
            }}
            onUploadingChange={setUploadingProof}
            required={Boolean(selectedCriterion?.needsProof)}
            disabled={submitting}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="e.g. Details about visitors, ask sheet, or workout selfie"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseSubmitModal}
              disabled={submitting || uploadingProof}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting || uploadingProof || !selectedCriteriaId}
              className="w-full sm:w-auto"
            >
              {uploadingProof ? 'Uploading photo...' : 'Submit entry'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MemberDashboard;
