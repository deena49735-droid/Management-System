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
          if (item.isActive) {
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
      setSelectedCriteriaId('');
      setQuantity(1);
      setEntryNote('');
      setProofImage('');
      setProofPublicId('');
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

  const totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  // Grouped criteria in PDF order for modal dropdown
  const groupedModalCriteria = CATEGORY_ORDER.reduce((acc, catKey) => {
    const items = criteriaList.filter((c) => c.categoryKey === catKey);
    if (items.length > 0) acc[catKey] = items;
    return acc;
  }, {});

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setBreakdownPeriod('week')}
              className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition ${
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
              className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition ${
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {breakdownData?.categories?.map((cat) => {
              const percent = Math.min(
                100,
                Math.round(((cat.earned || 0) / (cat.total || 1)) * 100)
              );

              return (
                <div key={cat.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      {cat.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      <span className="text-brand-600 font-bold">{cat.earned || 0}</span> / {cat.total}
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-500 font-medium tabular-nums">
                    {percent}% completed
                  </p>
                </div>
              );
            })}

            {/* Penalties item shown separately */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                  Penalties
                </span>
                <span className="text-base font-bold tabular-nums text-rose-600">
                  {breakdownData?.penalties?.earned || 0} pts
                </span>
              </div>
              <p className="text-xs text-rose-700/80 mt-2">
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
              <div className="flex flex-wrap items-center gap-1.5">
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
                    className={`h-8 min-h-[32px] rounded-lg px-2.5 text-xs font-semibold transition ${
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
                              <span className="ml-1 text-[11px] font-bold text-brand-600">(You)</span>
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
        onClose={() => setIsSubmitOpen(false)}
        title="Submit activity for verification"
        subtitle="Submit earned activity points to your Team Head"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          {submitError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCriteriaId}
              onChange={(e) => {
                setSelectedCriteriaId(e.target.value);
                setQuantity(1);
              }}
              required
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            >
              <option value="">— Select an activity —</option>
              {CATEGORY_ORDER.map(
                (catKey) =>
                  groupedModalCriteria[catKey] && (
                    <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                      {groupedModalCriteria[catKey].map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          {c.name} (+{c.points} pts, {c.basisLabel || 'Per Member'})
                        </option>
                      ))}
                    </optgroup>
                  )
              )}
            </select>
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
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSubmitOpen(false)}
              disabled={submitting || uploadingProof}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting || uploadingProof || !selectedCriteriaId}
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
