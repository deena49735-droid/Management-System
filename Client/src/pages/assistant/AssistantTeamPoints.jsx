import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';

const CATEGORY_NAMES = {
  monthly: 'Monthly Team Criteria (1,000 pts)',
  one_time: 'One-Time Team Bonus Points (1,000 pts)',
};

const AssistantTeamPoints = () => {
  const [teamCriteria, setTeamCriteria] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Form State
  const [criteriaId, setCriteriaId] = useState('');
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [note, setNote] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [criteriaRes, entriesRes] = await Promise.all([
        api.get('/criteria', { params: { level: 'team', isActive: true } }),
        api.get('/team-entries'),
      ]);

      setTeamCriteria(criteriaRes.data.data || []);
      setTeamEntries(entriesRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load team points data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedCriteria = teamCriteria.find((c) => c._id === criteriaId);
  const isOneTime = selectedCriteria?.category === 'one_time' || selectedCriteria?.frequency === 'one_time';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!criteriaId) {
      toast.error('Please select a team-level criteria.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/team-entries', {
        criteria: criteriaId,
        month: Number(month),
        year: Number(year),
        note: note ? note.trim() : undefined,
      });

      toast.success('Team point entry submitted successfully! Awaiting Team Head approval.');
      setCriteriaId('');
      setNote('');
      setTeamEntries((prev) => [res.data.data, ...prev]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit team entry.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading team points...</p>
      </div>
    );
  }

  // Group team criteria
  const groupedCriteria = teamCriteria.reduce((acc, c) => {
    const cat = c.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Team Monthly & Bonus Points
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Claim team-level bonus achievements or monthly scores for your team.
        </p>
      </div>

      {serverError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Submission Blocked:</p>
          <p className="mt-0.5">{serverError}</p>
        </div>
      )}

      {/* Submission Form Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
          Submit New Team Point Achievement
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Criteria Select */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Team Achievement Criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={criteriaId}
              onChange={(e) => setCriteriaId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select Team Criteria —</option>
              {Object.keys(groupedCriteria).map((cat) => (
                <optgroup key={cat} label={CATEGORY_NAMES[cat] || cat}>
                  {groupedCriteria[cat].map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} (+{c.points} pts)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Month & Year Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Target Month {isOneTime && '(Record Month)'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Target Year <span className="text-rose-500">*</span>
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          </div>

          {/* Points Preview */}
          {selectedCriteria && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Points Awarded</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isOneTime ? 'One-time bonus for the whole team' : 'Monthly bonus score'}
                </p>
              </div>
              <span className="text-2xl font-extrabold text-emerald-600">
                +{selectedCriteria.points} pts
              </span>
            </div>
          )}

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 100% attendance verified on 12 Nov"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting || !selectedCriteria}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Team Points'}
            </button>
          </div>
        </form>
      </div>

      {/* List of Team Entries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            Your Team's Bonus Submissions ({teamEntries.length})
          </h2>
        </div>

        <EntriesTable
          entries={teamEntries}
          loading={loading}
          showMember={false}
          emptyMessage="No team bonus entries submitted yet."
        />
      </div>
    </div>
  );
};

export default AssistantTeamPoints;

