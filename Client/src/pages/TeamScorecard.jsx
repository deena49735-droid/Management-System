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
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { Trophy } from 'lucide-react';

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
    label: 'Not submitted',
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
        title={scorecard?.team?.name ? `${scorecard.team.name} scorecard` : 'Team scorecard'}
        subtitle="Monthly criteria points and one-time bonus achievements tracking."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="flex-1 sm:flex-initial h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
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
              className="flex-1 sm:flex-initial h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
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
        <div className="space-y-6">
          <SkeletonTable rows={5} cols={5} />
          <SkeletonTable rows={5} cols={5} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Monthly Points */}
          <Card
            title="Monthly points"
            subtitle="Target criteria evaluated each calendar month"
            action={
              <Badge variant="neutral">
                {MONTHS.find((m) => m.value === month)?.label} {year}
              </Badge>
            }
            className="overflow-hidden p-0"
          >
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Criteria item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Proof</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAssistant && <th className="py-3 px-5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scorecard?.monthly?.items?.map((item) => {
                    const badge = statusStyles[item.status] || statusStyles.not_submitted;
                    const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                    return (
                      <tr key={item.criterion.id || item.criterion._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-5 text-right">
                            {canSubmit ? (
                              <Button
                                size="sm"
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
                    <td className="py-3.5 px-5 text-xs uppercase tracking-wider text-slate-600">Total monthly points</td>
                    <td colSpan={isAssistant ? 4 : 3} className="py-3.5 px-5 text-right tabular-nums">
                      <span className="text-brand-600 font-bold text-base">
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

            {/* Mobile Cards View (Below 768px: clean cards, no horizontal scroll) */}
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
              {scorecard?.monthly?.items?.map((item) => {
                const badge = statusStyles[item.status] || statusStyles.not_submitted;
                const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                return (
                  <div key={item.criterion.id || item.criterion._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm leading-snug">
                          {item.criterion.name}
                        </p>
                        <p className="text-xs font-bold text-emerald-600 mt-1 tabular-nums">
                          +{item.criterion.points} pts
                        </p>
                      </div>
                      <Badge variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />

                      {isAssistant && (
                        <div>
                          {canSubmit ? (
                            <Button
                              size="sm"
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="p-4 bg-slate-50/80 border-t-2 border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total monthly points</span>
                <span className="text-sm font-bold tabular-nums">
                  <span className="text-brand-600">{scorecard?.monthly?.earned || 0}</span>
                  <span className="text-slate-400"> / {scorecard?.monthly?.total || 5000}</span>
                </span>
              </div>
            </div>
          </Card>

          {/* SECTION 2: One Time Bonus Points */}
          <Card
            title="One time bonus points"
            subtitle="All-time chapter achievement bonuses"
            action={
              <Badge variant="success">
                All-time achievements
              </Badge>
            }
            className="overflow-hidden p-0"
          >
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Criteria item</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-center">Proof</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAssistant && <th className="py-3 px-5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scorecard?.oneTime?.items?.map((item) => {
                    const badge = statusStyles[item.status] || statusStyles.not_submitted;
                    const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                    return (
                      <tr key={item.criterion.id || item.criterion._id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          {item.criterion.name}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold tabular-nums text-emerald-600">
                          +{item.criterion.points}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        </td>
                        {isAssistant && (
                          <td className="py-3.5 px-5 text-right">
                            {canSubmit ? (
                              <Button
                                size="sm"
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
                    <td className="py-3.5 px-5 text-xs uppercase tracking-wider text-slate-600">Total one-time points</td>
                    <td colSpan={isAssistant ? 4 : 3} className="py-3.5 px-5 text-right tabular-nums">
                      <span className="text-brand-600 font-bold text-base">
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

            {/* Mobile Cards View (Below 768px: clean cards, no horizontal scroll) */}
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
              {scorecard?.oneTime?.items?.map((item) => {
                const badge = statusStyles[item.status] || statusStyles.not_submitted;
                const canSubmit = isAssistant && (item.status === 'not_submitted' || item.status === 'rejected');

                return (
                  <div key={item.criterion.id || item.criterion._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm leading-snug">
                          {item.criterion.name}
                        </p>
                        <p className="text-xs font-bold text-emerald-600 mt-1 tabular-nums">
                          +{item.criterion.points} pts
                        </p>
                      </div>
                      <Badge variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <ProofImage src={item.entry?.proofImage} alt={item.criterion.name} />

                      {isAssistant && (
                        <div>
                          {canSubmit ? (
                            <Button
                              size="sm"
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="p-4 bg-slate-50/80 border-t-2 border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total one-time points</span>
                <span className="text-sm font-bold tabular-nums">
                  <span className="text-brand-600">{scorecard?.oneTime?.earned || 0}</span>
                  <span className="text-slate-400"> / {scorecard?.oneTime?.total || 5000}</span>
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Submission Modal for Team Assistant */}
      {isAssistant && (
        <Modal
          isOpen={!!submittingCriterion}
          onClose={() => setSubmittingCriterion(null)}
          title={`Submit team goal: ${submittingCriterion?.criterion?.name || ''}`}
          subtitle="Submit points claim for chapter leadership review"
        >
          <form onSubmit={handleSubmitScorecardItem} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Activity points</p>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Notes or remarks (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add any supporting remarks or completion details..."
                className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
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
                isLoading={submitting}
                disabled={submitting || uploadingProof}
              >
                {uploadingProof ? 'Uploading photo...' : 'Confirm and submit'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TeamScorecard;
