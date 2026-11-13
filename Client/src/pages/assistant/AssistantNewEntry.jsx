import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities (Weekly)',
  non_meeting_day: 'Non-Meeting Day Activities (Weekly)',
  penalty: 'Penalties (Negative Points)',
};

const QUANTITY_BASES = ['per_visitor', 'per_testimonial', 'per_specific_ask'];

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const AssistantNewEntry = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [criteriaList, setCriteriaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Form State
  const [memberId, setMemberId] = useState('');
  const [criteriaId, setCriteriaId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        setLoading(true);
        const [teamRes, criteriaRes] = await Promise.all([
          api.get('/teams/my'),
          api.get('/criteria', { params: { level: 'member', isActive: true } }),
        ]);

        setTeam(teamRes.data.data);
        setCriteriaList(criteriaRes.data.data || []);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to initialize entry form.');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, []);

  // Selected criteria doc
  const selectedCriteria = criteriaList.find((c) => c._id === criteriaId);
  const showQuantity = selectedCriteria && QUANTITY_BASES.includes(selectedCriteria.basis);
  const previewPoints = selectedCriteria ? selectedCriteria.points * (showQuantity ? (Number(quantity) || 1) : 1) : 0;
  const isNegative = previewPoints < 0;

  // Flatten team members
  const teamMembers = team
    ? [
        ...(team.head ? [{ ...team.head, teamRole: 'Team Head' }] : []),
        ...(team.assistant ? [{ ...team.assistant, teamRole: 'Team Assistant' }] : []),
        ...(team.members || []).map((m) => ({ ...m, teamRole: 'Member' })),
      ]
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!memberId) {
      toast.error('Please select a team member.');
      return;
    }

    if (!criteriaId) {
      toast.error('Please select an activity criteria.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/entries', {
        member: memberId,
        criteria: criteriaId,
        quantity: showQuantity ? Number(quantity) || 1 : 1,
        date: date || new Date().toISOString(),
        note: note ? note.trim() : undefined,
      });

      toast.success('Point entry submitted successfully! Awaiting Head approval.');
      // Reset form
      setCriteriaId('');
      setQuantity(1);
      setNote('');
      navigate('/assistant/submissions');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit point entry.';
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
        <p className="text-sm font-medium text-slate-500">Loading form options...</p>
      </div>
    );
  }

  // Group active criteria by category
  const groupedCriteria = criteriaList.reduce((acc, c) => {
    const cat = c.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Record Member Point Entry
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit activity or penalty points for members of <span className="font-semibold text-emerald-700">{team?.name}</span>.
        </p>
      </div>

      {serverError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Submission Blocked:</p>
          <p className="mt-0.5">{serverError}</p>
        </div>
      )}

      {/* Entry Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Team Member Select */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Team Member <span className="text-rose-500">*</span>
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select a Member —</option>
              {teamMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.teamRole}) - {m.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Criteria Select */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Activity Criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={criteriaId}
              onChange={(e) => {
                setCriteriaId(e.target.value);
                setQuantity(1);
              }}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select Activity / Penalty —</option>
              {Object.keys(groupedCriteria).map((cat) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                  {groupedCriteria[cat].map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.points > 0 ? `+${c.points}` : c.points} pts{c.basis ? ` • ${c.basis.replace(/_/g, ' ')}` : ''})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Quantity Field (conditionally shown) */}
          {showQuantity && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1.5">
                Quantity ({selectedCriteria.basis.replace(/_/g, ' ')}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-emerald-700 mt-1">
                Base points: {selectedCriteria.points} &times; {quantity} = {selectedCriteria.points * quantity} points
              </p>
            </div>
          )}

          {/* Points Preview Box */}
          {selectedCriteria && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Points to be Awarded</p>
                <p className="text-xs text-slate-400 mt-0.5">Calculated securely on the server</p>
              </div>
              <span
                className={`text-xl sm:text-2xl font-extrabold ${
                  isNegative ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {isNegative ? previewPoints : `+${previewPoints}`} pts
              </span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Activity Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Note (Optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Visitor: Jane Doe from ABC Corp"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/assistant')}
              disabled={submitting}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedCriteria || !memberId}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssistantNewEntry;

