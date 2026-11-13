import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ProofUpload from '../components/ProofUpload';
import ProofImage from '../components/ProofImage';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';

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
    variant: 'success',
    label: 'Approved',
  },
  pending: {
    variant: 'warning',
    label: 'Pending',
  },
  rejected: {
    variant: 'danger',
    label: 'Rejected',
  },
  not_submitted: {
    variant: 'neutral',
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
  const [proofPublicId, setProofPublicId] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
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
    setProofPublicId('');
  };

  const handleSubmitScorecardItem = async (e) => {
    e.preventDefault();
    if (!submittingCriterion) return;

    if (submittingCriterion?.criterion?.needsProof && !proofImage) {
      toast.error(`Photo proof is required for "${submittingCriterion.criterion.name}". Please upload an image.`);
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/team-entries', {
        criteria: submittingCriterion.criterion.id || submittingCriterion.criterion._id,
        month,
        year,
        note: note.trim(),
        proofImage: proofImage.trim() || undefined,
        proofPublicId: proofPublicId || undefined,
        team: scorecard?.team?._id || user?.team,
      });

      toast.success('Team entry submitted successfully for review.');
      setSubmittingCriterion(null);
      setProofImage('');
      setProofPublicId('');
      await fetchScorecard();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit team entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAssistant = user?.role === 'teamAssistant' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header with Back button */}
      <PageHeader
        title={scorecard?.team?.name ? `${scorecard.team.name} Scorecard` : 'Team Scorecard'}
        subtitle="Monthly criteria points and one-time bonus achievements tracking."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-10 min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="h-10 min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {loading ? (
        <Card className="p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-500">Loading scorecard...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Monthly Points */}
          <Card>
            <Card.Header
              title="Monthly Points"
              subtitle="Target criteria evaluated each calendar month"
              action={
                <Badge variant="brand">
                  {MONTHS.find((m) => m.value === month)?.label} {year}
                </Badge>
              }
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 sm:px-6">Criteria Item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Proof</th>
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
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant={badge.variant} size="xs">
                            {badge.label}
                          </Badge>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-4 text-center">
                            {canSubmit ? (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => handleOpenSubmit(item)}
                              >
                                Submit
                              </Button>
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
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900">
                    <td className="py-3.5 px-4 sm:px-6 text-xs uppercase tracking-wider text-slate-600">Total Monthly Points</td>
                    <td colSpan={isAssistant ? 4 : 3} className="py-3.5 px-4 text-right tabular-nums">
                      <span className="text-indigo-600 font-bold text-base">
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
          </Card>

          {/* SECTION 2: One Time Bonus Points */}
          <Card>
            <Card.Header
              title="One Time Bonus Points"
              subtitle="All-time chapter achievement bonuses"
              action={
                <Badge variant="success">
                  All-Time Achievements
                </Badge>
              }
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 sm:px-6">Criteria Item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Proof</th>
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
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant={badge.variant} size="xs">
                            {badge.label}
                          </Badge>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-4 text-center">
                            {canSubmit ? (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => handleOpenSubmit(item)}
                              >
                                Submit
                              </Button>
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
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900">
                    <td className="py-3.5 px-4 sm:px-6 text-xs uppercase tracking-wider text-slate-600">Total One-Time Points</td>
                    <td colSpan={isAssistant ? 4 : 3} className="py-3.5 px-4 text-right tabular-nums">
                      <span className="text-indigo-600 font-bold text-base">
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
          </Card>
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
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Activity Points</p>
                <p className="text-base font-bold tabular-nums text-emerald-600">
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

            {/* Photo Proof Upload */}
            <ProofUpload
              value={proofImage}
              onChange={({ url, publicId }) => {
                setProofImage(url);
                setProofPublicId(publicId);
              }}
              onUploadingChange={setUploadingProof}
              required={Boolean(submittingCriterion?.criterion?.needsProof)}
              disabled={submitting}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Notes / Remarks (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add any supporting remarks or completion details..."
                className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSubmittingCriterion(null)}
                disabled={submitting || uploadingProof}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={submitting || uploadingProof}
              >
                {uploadingProof ? 'Uploading photo...' : 'Confirm & Submit'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TeamScorecard;
