import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, Calendar, PlusCircle, CheckCircle2, Clock } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ProofUpload from '../../components/ProofUpload';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { SkeletonCard } from '../../components/Skeleton';

const CATEGORY_ORDER = ['meeting_day', 'non_meeting_day', 'penalty'];

const CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities',
  non_meeting_day: 'Non-Meeting Day Activities',
  penalty: 'Negative Points Criteria',
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

const AssistantNewEntry = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHead = user?.role === 'teamHead';
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
  const [proofImage, setProofImage] = useState('');
  const [proofPublicId, setProofPublicId] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        setLoading(true);
        const [teamRes, criteriaRes] = await Promise.all([
          api.get('/teams/my'),
          api.get('/criteria/structure'),
        ]);

        setTeam(teamRes.data.data);

        // Flatten member-level categories in PDF order
        const memberCats = (criteriaRes.data.data || []).filter(
          (cat) => cat.key === 'meeting_day' || cat.key === 'non_meeting_day' || cat.key === 'penalty'
        );

        const flattened = [];
        memberCats.forEach((cat) => {
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
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to initialize entry form.');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, []);

  const selectedCriteria = criteriaList.find((c) => (c.id || c._id) === criteriaId);
  const showQuantity = selectedCriteria && allowsMultipleQuantity(selectedCriteria.basisLabel);
  const previewPoints = selectedCriteria
    ? selectedCriteria.points * (showQuantity ? Number(quantity) || 1 : 1)
    : 0;
  const isNegative = previewPoints < 0;

  // Filter active chapter users with role "member" belonging to this team (excluding Head and Assistant)
  const headId = team?.head?._id ? team.head._id.toString() : team?.head?.toString() || '';
  const assistantId = team?.assistant?._id ? team.assistant._id.toString() : team?.assistant?.toString() || '';

  const teamMembers = (team?.members || []).filter((m) => {
    if (!m || !m._id) return false;
    const mId = m._id.toString();
    return (
      m.isActive !== false &&
      m.role === 'member' &&
      mId !== headId &&
      mId !== assistantId
    );
  });

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
        proofImage: proofImage || undefined,
        proofPublicId: proofPublicId || undefined,
      });

      toast.success(
        isHead
          ? 'Point entry submitted and auto-approved!'
          : 'Point entry submitted successfully! Awaiting Head approval.'
      );
      window.dispatchEvent(new CustomEvent('kadambas:approvals-changed'));
      navigate(isHead ? '/head/history' : '/assistant/submissions');
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
      <div className="mx-auto max-w-2xl space-y-6">
        <SkeletonCard rows={5} />
      </div>
    );
  }

  // Group criteria in strict PDF category order
  const groupedCriteria = CATEGORY_ORDER.reduce((acc, catKey) => {
    const items = criteriaList.filter((c) => c.categoryKey === catKey);
    if (items.length > 0) {
      acc[catKey] = items;
    }
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Submit team activity"
        subtitle={
          isHead
            ? `Submit activity or penalty points for members of ${team?.name || 'your team'}. Entries are automatically approved.`
            : `Submit activity or penalty points for members of ${team?.name || 'your team'}. Submissions will be sent to the Team Head for approval.`
        }
      />

      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">Submission blocked:</p>
            <p className="mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      {/* Entry Form */}
      <Card className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Member and Criteria Selection (Two columns on desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Team member <span className="text-rose-500">*</span>
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              >
                <option value="">— Select a member —</option>
                {teamMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} (@{m.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Activity date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              />
            </div>
          </div>

          {/* Criteria Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={criteriaId}
              onChange={(e) => {
                setCriteriaId(e.target.value);
                setQuantity(1);
              }}
              required
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            >
              <option value="">— Select activity or penalty —</option>
              {CATEGORY_ORDER.map(
                (catKey) =>
                  groupedCriteria[catKey] && (
                    <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                      {groupedCriteria[catKey].map((c) => {
                        const ptsStr = c.points > 0 ? `+${c.points} pts` : `${c.points} pts`;
                        const basisStr = c.basisLabel || 'Per Member';
                        return (
                          <option key={c.id || c._id} value={c.id || c._id}>
                            {c.name} ({ptsStr}, {basisStr})
                          </option>
                        );
                      })}
                    </optgroup>
                  )
              )}
            </select>
          </div>

          {/* Quantity Field */}
          {showQuantity && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
              <Input
                label={`Quantity (${selectedCriteria?.basisLabel})`}
                type="number"
                min="1"
                max="50"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                helperText={`Calculated as ${selectedCriteria.points} points × ${Number(quantity) || 1} units.`}
              />
            </div>
          )}

          {/* Photo Proof Upload */}
          <ProofUpload
            value={proofImage}
            onChange={({ url, publicId }) => {
              setProofImage(url);
              setProofPublicId(publicId);
            }}
            onUploadingChange={setUploadingProof}
            required={false}
            disabled={submitting}
          />

          {/* Note Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes or remarks (Optional)
            </label>
            <textarea
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Details, visitor name, cross-chapter details..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          {/* Points Live Preview */}
          {selectedCriteria && (
            <div
              className={`flex items-center justify-between rounded-lg border p-4 ${isNegative ? 'border-rose-200 bg-rose-50/50' : 'border-emerald-200 bg-emerald-50/50'
                }`}
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Points preview
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedCriteria.points} pts {showQuantity ? `× ${Number(quantity) || 1}` : ''}
                </p>
              </div>
              <div
                className={`text-2xl font-bold tabular-nums ${isNegative ? 'text-rose-600' : 'text-emerald-700'
                  }`}
              >
                {previewPoints > 0 ? `+${previewPoints}` : previewPoints} pts
              </div>
            </div>
          )}

          {/* Approval Workflow Notice */}
          {isHead ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Team Head entries are automatically approved and immediately reflected on leaderboards.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Team Assistant entries are submitted as pending and must be approved by your Team Head.</span>
            </div>
          )}

          {/* Sticky action footer on mobile */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(isHead ? '/head' : '/assistant'))}
              disabled={submitting || uploadingProof}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting || uploadingProof}
              className="w-full sm:w-auto"
            >
              {uploadingProof
                ? 'Uploading photo...'
                : isHead
                ? 'Submit & Auto-Approve'
                : 'Submit for approval'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AssistantNewEntry;
