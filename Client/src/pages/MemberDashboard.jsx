import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import EntriesTable from '../components/EntriesTable';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';

const PAGE_SIZE = 15;

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
  const [proofCriteria, setProofCriteria] = useState([]);
  const [memberRank, setMemberRank] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [teamRank, setTeamRank] = useState(null);
  const [totalTeams, setTotalTeams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Submit Modal State
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [entryNote, setEntryNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, entriesRes, criteriaRes, teamLeaderboardRes, memberLeaderboardRes] =
        await Promise.all([
          api.get('/entries/my-summary'),
          api.get('/entries', { params: statusFilter ? { status: statusFilter } : {} }),
          api.get('/criteria', { params: { level: 'member', isActive: true } }),
          api.get('/leaderboard/teams', { params: { period: 'month' } }),
          api.get('/leaderboard/members', { params: { period: 'month' } }),
        ]);

      setSummary(summaryRes.data.data || {});
      setEntries(entriesRes.data.data || []);
      // Filter criteria that members are allowed to submit (needsProof === true)
      const allowed = (criteriaRes.data.data || []).filter((c) => c.needsProof === true);
      setProofCriteria(allowed);

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

  useEffect(() => {
    fetchDashboardData();
  }, [statusFilter]);

  const selectedCriterion = proofCriteria.find((c) => c._id === selectedCriteriaId);

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!selectedCriteriaId) {
      toast.error('Please select an activity.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/entries', {
        member: user._id,
        criteria: selectedCriteriaId,
        date: entryDate,
        note: entryNote ? entryNote.trim() : undefined,
      });

      toast.success('Activity submitted! Awaiting Team Head approval.');
      setIsSubmitOpen(false);
      setSelectedCriteriaId('');
      setEntryNote('');
      fetchDashboardData();
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

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
            <span>+ Submit My Activity</span>
          </button>
        </div>

        {/* Summary Cards */}
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

        {/* My Entries Section */}
        <div className="space-y-4">
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
              Eligible Activity <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCriteriaId}
              onChange={(e) => setSelectedCriteriaId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select an activity —</option>
              {proofCriteria.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} (+{c.points} pts)
                </option>
              ))}
            </select>
          </div>

          {selectedCriterion && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-xs font-semibold text-slate-600">Points to be awarded:</span>
              <span className="text-lg font-bold text-emerald-600">+{selectedCriterion.points} pts</span>
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="e.g. Completed health workout with morning selfie"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Photo upload hint */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-800 flex items-center gap-2">
            <svg className="h-5 w-5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Photo upload will be added soon. Your Team Head will verify this submission.</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSubmitOpen(false)}
              disabled={submitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedCriteriaId}
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MemberDashboard;
