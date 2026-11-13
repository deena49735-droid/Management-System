import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import EntriesTable from '../components/EntriesTable';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import ProofUpload from '../components/ProofUpload';

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
  const [loading, setLoading] = useState(true);
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
      const me = membersList.find((m) => m.userId === user?._id);
      if (me) setMemberRank(me.rank);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load member dashboard.');
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

  const scrollToEntries = () => {
    const el = document.getElementById('my-entries-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Grouped criteria in PDF order for modal dropdown
  const groupedModalCriteria = CATEGORY_ORDER.reduce((acc, catKey) => {
    const items = criteriaList.filter((c) => c.categoryKey === catKey);
    if (items.length > 0) acc[catKey] = items;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Member Sub-Navigation Menu (Dashboard, My entries, Submit entry, Game criteria, Leaderboard) */}
      <div className="border-b border-slate-200 bg-white sticky top-[61px] z-30 shadow-2xs">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto py-2">
            <NavLink
              to="/dashboard"
              end
              className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap bg-indigo-50 text-indigo-700 shadow-2xs"
            >
              <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </NavLink>

            <button
              onClick={scrollToEntries}
              className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>My entries</span>
            </button>

            <button
              onClick={() => {
                setSubmitError('');
                setProofImage('');
                setProofPublicId('');
                setIsSubmitOpen(true);
              }}
              className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Submit entry</span>
            </button>

            <NavLink
              to="/criteria"
              className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span>Game criteria</span>
            </NavLink>

            <NavLink
              to="/leaderboard"
              className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Leaderboard</span>
            </NavLink>
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Member Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome, <span className="font-semibold text-slate-800">{user?.name}</span>. Team:{' '}
              <span className="font-semibold text-indigo-700">{user?.team?.name || 'Unassigned'}</span>
            </p>
          </div>

          <button
            onClick={() => {
              setSubmitError('');
              setIsSubmitOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-indigo-700 active:bg-indigo-800 transition"
          >
            <span>+ Submit Entry</span>
          </button>
        </div>

        {/* Summary Rank & Point Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">My Rank</p>
            <p className="mt-2 text-2xl font-extrabold text-amber-600">
              {memberRank !== null ? `#${memberRank}` : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-400">of {totalMembers} this month</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">My Team Rank</p>
            <p className="mt-2 text-2xl font-extrabold text-blue-600">
              {teamRank !== null ? `#${teamRank}` : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-400">of {totalTeams} this month</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Points</p>
            <p className="mt-2 text-2xl font-extrabold text-emerald-600">
              {summary.approvedTotal || 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Lifetime approved</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">This Week's Points</p>
            <p className="mt-2 text-2xl font-extrabold text-indigo-600">
              {summary.weekTotal || 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Current week approved</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Penalties</p>
            <p className="mt-2 text-2xl font-extrabold text-rose-600">
              {summary.penaltyTotal || 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Negative deductions</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Pending Review</p>
            <p className="mt-2 text-2xl font-extrabold text-amber-600">
              {summary.pendingCount || 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Awaiting approval</p>
          </div>
        </div>

        {/* My Points by Category Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Points by Category</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Target performance breakdown comparing earned points against maximum available category totals.
              </p>
            </div>

            {/* This week / This month toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setBreakdownPeriod('week')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  breakdownPeriod === 'week'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This week
              </button>
              <button
                onClick={() => setBreakdownPeriod('month')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  breakdownPeriod === 'month'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This month
              </button>
            </div>
          </div>

          {breakdownLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading breakdown...</div>
          ) : (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {breakdownData?.categories?.map((cat) => {
                const percent = Math.min(
                  100,
                  Math.round(((cat.earned || 0) / (cat.total || 1)) * 100)
                );

                return (
                  <div key={cat.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {cat.label}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900">
                        <span className="text-indigo-600">{cat.earned || 0}</span> / {cat.total}
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] text-slate-400 font-medium">{percent}% completed</p>
                  </div>
                );
              })}

              {/* Penalties item shown separately */}
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                    Penalties
                  </span>
                  <span className="text-base font-extrabold text-rose-600">
                    {breakdownData?.penalties?.earned || 0} pts
                  </span>
                </div>
                <p className="text-xs text-rose-600/80 mt-2">
                  Total deductions incurred for {breakdownPeriod === 'week' ? 'this week' : 'this month'}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* My Activity Entries Section */}
        <div id="my-entries-section" className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Activity Entries</h2>
              <p className="text-xs text-slate-500">Track and review all your point logs</p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['', 'approved', 'pending', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st === '' ? 'All Entries' : st}
                </button>
              ))}
            </div>
          </div>

          <EntriesTable
            entries={paginatedEntries}
            loading={loading}
            showMember={false}
            emptyMessage="You have no point entries matching this filter."
          />

          {totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </main>

      {/* Submit Activity Modal */}
      <Modal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        title="Submit Activity for Verification"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Activity Criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCriteriaId}
              onChange={(e) => {
                setSelectedCriteriaId(e.target.value);
                setQuantity(1);
              }}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          {/* Quantity Field (conditionally shown under quantity rule) */}
          {showQuantity && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Quantity ({selectedCriterion?.basisLabel}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Calculated as {selectedCriterion.points} points × {Number(quantity) || 1} units.
              </p>
            </div>
          )}

          {/* Points Live Preview */}
          {selectedCriterion && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
              <span className="text-xs font-semibold text-slate-600">Calculated Points Preview:</span>
              <span className="text-lg font-bold text-emerald-700">+{previewPoints} pts</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Activity Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="e.g. Details about visitors, ask sheet, or workout selfie"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSubmitOpen(false)}
              disabled={submitting || uploadingProof}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingProof || !selectedCriteriaId}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : uploadingProof ? 'Uploading photo...' : 'Submit Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MemberDashboard;
