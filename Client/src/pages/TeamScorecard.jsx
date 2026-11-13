import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

const statusStyles = {
  approved: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Approved',
  },
  pending: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  rejected: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Rejected',
  },
  not_submitted: {
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Not Submitted',
  },
};

const TeamScorecard = () => {
  const { user } = useAuth();
  const currentDate = new Date();

  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);

  // Submit Modal State (Team Assistant)
  const [submittingCriterion, setSubmittingCriterion] = useState(null);
  const [note, setNote] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchScorecard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/team-scorecard', {
        params: { month, year },
      });
      setScorecard(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load team scorecard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, [month, year]);

  const handleOpenSubmit = (item) => {
    setSubmittingCriterion(item);
    setNote('');
    setProofImage('');
  };

  const handleSubmitScorecardItem = async (e) => {
    e.preventDefault();
    if (!submittingCriterion) return;

    try {
      setSubmitting(true);
      await api.post('/team-entries', {
        criteria: submittingCriterion.criterion.id || submittingCriterion.criterion._id,
        month,
        year,
        note: note.trim(),
        proofImage: proofImage.trim() || null,
        team: scorecard?.team?._id || user?.team,
      });

      toast.success('Team entry submitted successfully for review.');
      setSubmittingCriterion(null);
      await fetchScorecard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit team entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAssistant = user?.role === 'teamAssistant' || user?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Header & Month/Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {scorecard?.team?.name ? `${scorecard.team.name} Scorecard` : 'Team Scorecard'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monthly criteria points and one-time bonus achievements tracking.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading scorecard...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: Monthly Points */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Monthly Points</h2>
              </div>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {MONTHS.find((m) => m.value === month)?.label} {year}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 sm:px-6">Criteria Item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAssistant && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scorecard?.monthly?.items?.map((item) => {
                    const badge = statusStyles[item.status] || statusStyles.not_submitted;
                    const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                    return (
                      <tr key={item.criterion.id || item.criterion._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-4 text-center">
                            {canSubmit ? (
                              <button
                                onClick={() => handleOpenSubmit(item)}
                                className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition"
                              >
                                Submit
                              </button>
                            ) : item.status === 'pending' ? (
                              <span className="text-xs text-slate-400">Awaiting Head</span>
                            ) : item.status === 'approved' ? (
                              <span className="text-xs text-emerald-600 font-semibold">Earned</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                    <td className="py-3.5 px-4 sm:px-6">TOTAL</td>
                    <td colSpan={isAssistant ? 3 : 2} className="py-3.5 px-4 text-right">
                      <span className="text-indigo-600 font-extrabold text-base">
                        {scorecard?.monthly?.earned || 0}
                      </span>
                      <span className="text-slate-400 font-medium text-sm">
                        {' '}/ {scorecard?.monthly?.total || 5000}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SECTION 2: One Time Bonus Points */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">One Time Bonus Points</h2>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                All-Time Achievements
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 sm:px-6">Criteria Item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAssistant && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scorecard?.oneTime?.items?.map((item) => {
                    const badge = statusStyles[item.status] || statusStyles.not_submitted;
                    const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                    return (
                      <tr key={item.criterion.id || item.criterion._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-4 text-center">
                            {canSubmit ? (
                              <button
                                onClick={() => handleOpenSubmit(item)}
                                className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition"
                              >
                                Submit
                              </button>
                            ) : item.status === 'pending' ? (
                              <span className="text-xs text-slate-400">Awaiting Head</span>
                            ) : item.status === 'approved' ? (
                              <span className="text-xs text-emerald-600 font-semibold">Earned</span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                    <td className="py-3.5 px-4 sm:px-6">TOTAL</td>
                    <td colSpan={isAssistant ? 3 : 2} className="py-3.5 px-4 text-right">
                      <span className="text-indigo-600 font-extrabold text-base">
                        {scorecard?.oneTime?.earned || 0}
                      </span>
                      <span className="text-slate-400 font-medium text-sm">
                        {' '}/ {scorecard?.oneTime?.total || 5000}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Submission Modal for Team Assistant */}
      {isAssistant && (
        <Modal
          isOpen={!!submittingCriterion}
          onClose={() => setSubmittingCriterion(null)}
          title={`Submit Team Goal: ${submittingCriterion?.criterion?.name || ''}`}
        >
          <form onSubmit={handleSubmitScorecardItem} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Activity Points</p>
                <p className="text-base font-bold text-emerald-600">
                  +{submittingCriterion?.criterion?.points || 1000} pts
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-medium">Period</p>
                <p className="text-sm font-semibold text-slate-800">
                  {MONTHS.find((m) => m.value === month)?.label} {year}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proof Image URL (Optional)
              </label>
              <input
                type="url"
                value={proofImage}
                onChange={(e) => setProofImage(e.target.value)}
                placeholder="https://example.com/proof.jpg"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes / Remarks (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add any supporting remarks or completion details..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSubmittingCriterion(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TeamScorecard;

