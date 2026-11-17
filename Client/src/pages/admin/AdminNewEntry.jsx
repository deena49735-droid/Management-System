import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, Calendar, PlusCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
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

const AdminNewEntry = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
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

  // Dedicated member loading state
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [membersReloadKey, setMembersReloadKey] = useState(0);

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        setLoading(true);
        const [teamsRes, criteriaRes] = await Promise.all([
          api.get('/teams'),
          api.get('/criteria/structure'),
        ]);

        setTeams(teamsRes.data.data || []);

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

  // Fetch eligible team members whenever selected team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setTeamMembers([]);
      setMemberId('');
      setLoadingMembers(false);
      setMembersError('');
      return;
    }

    let isMounted = true;
    setLoadingMembers(true);
    setMembersError('');
    setMemberId('');

    const fetchTeamMembers = async () => {
      try {
        // Fetch team details (populates head, assistant, members) and users in this team
        const [teamRes, usersRes] = await Promise.allSettled([
          api.get(`/teams/${selectedTeamId}`),
          api.get('/users', { params: { team: selectedTeamId, isActive: 'true', limit: 100 } }),
        ]);

        if (!isMounted) return;

        const candidateList = [];

        if (teamRes.status === 'fulfilled' && teamRes.value?.data?.data) {
          const teamDoc = teamRes.value.data.data;
          if (teamDoc.head && typeof teamDoc.head === 'object') {
            candidateList.push(teamDoc.head);
          }
          if (teamDoc.assistant && typeof teamDoc.assistant === 'object') {
            candidateList.push(teamDoc.assistant);
          }
          if (Array.isArray(teamDoc.members)) {
            teamDoc.members.forEach((m) => {
              if (m && typeof m === 'object') {
                candidateList.push(m);
              }
            });
          }
        }

        if (usersRes.status === 'fulfilled' && usersRes.value?.data?.data) {
          const userArray = usersRes.value.data.data.users || usersRes.value.data.data;
          if (Array.isArray(userArray)) {
            userArray.forEach((u) => {
              if (u && typeof u === 'object') {
                candidateList.push(u);
              }
            });
          }
        }

        if (teamRes.status === 'rejected' && usersRes.status === 'rejected') {
          const errorMsg =
            teamRes.reason?.response?.data?.message ||
            usersRes.reason?.response?.data?.message ||
            'Failed to load team members.';
          throw new Error(errorMsg);
        }

        // Deduplicate and filter strictly
        const seen = new Set();
        const validMembers = [];

        candidateList.forEach((u) => {
          const uid = (u._id || u.id)?.toString();
          if (!uid) return;
          if (seen.has(uid)) return;
          seen.add(uid);

          // Enforce: Must be active, must NOT be admin, must have valid chapter role
          if (u.isActive === false) return;
          if (u.role === 'admin') return;
          if (!['member', 'teamHead', 'teamAssistant'].includes(u.role)) return;

          validMembers.push(u);
        });

        // Sort: Team Head first, then Team Assistant, then Members alphabetically by name
        validMembers.sort((a, b) => {
          const roleOrder = { teamHead: 1, teamAssistant: 2, member: 3 };
          const orderA = roleOrder[a.role] || 4;
          const orderB = roleOrder[b.role] || 4;
          if (orderA !== orderB) return orderA - orderB;
          return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        });

        setTeamMembers(validMembers);
      } catch (err) {
        if (!isMounted) return;
        const msg = err.message || 'Failed to load team members.';
        console.error('Error fetching team members:', err);
        setMembersError(msg);
        setTeamMembers([]);
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };

    fetchTeamMembers();

    return () => {
      isMounted = false;
    };
  }, [selectedTeamId, membersReloadKey]);

  const selectedCriteria = criteriaList.find((c) => (c.id || c._id) === criteriaId);
  const showQuantity = selectedCriteria && allowsMultipleQuantity(selectedCriteria.basisLabel);
  const previewPoints = selectedCriteria
    ? selectedCriteria.points * (showQuantity ? Number(quantity) || 1 : 1)
    : 0;
  const isNegative = previewPoints < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!selectedTeamId) {
      toast.error('Please select a team.');
      return;
    }

    if (!memberId) {
      toast.error('Please select a member.');
      return;
    }

    if (!criteriaId) {
      toast.error('Please select an activity criteria.');
      return;
    }

    if (selectedCriteria?.needsProof && !proofImage) {
      const msg = `Photo proof is required for "${selectedCriteria.name}". Please upload a proof photo.`;
      setServerError(msg);
      toast.error(msg);
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

      toast.success('Activity created and auto-approved!');
      window.dispatchEvent(new CustomEvent('kadambas:approvals-changed'));
      navigate('/admin/entries');
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
        backTo="/admin/entries"
        title="Submit member point entry"
        subtitle="Submit activity or penalty points for any chapter member. Entries are automatically approved."
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
          {/* Section: Team & Member Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Team <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setMemberId('');
                }}
                required
                disabled={loading || submitting}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">-- Choose team --</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Member <span className="text-rose-500">*</span>
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
                disabled={!selectedTeamId || loadingMembers || submitting || (!loadingMembers && teamMembers.length === 0)}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {!selectedTeamId ? (
                  <option value="">-- Choose team first --</option>
                ) : loadingMembers ? (
                  <option value="">Loading members...</option>
                ) : membersError ? (
                  <option value="">Error loading members</option>
                ) : teamMembers.length === 0 ? (
                  <option value="">No active members found in this team</option>
                ) : (
                  <>
                    <option value="">-- Choose member ({teamMembers.length} available) --</option>
                    {teamMembers.map((m) => {
                      const roleTag =
                        m.role === 'teamHead'
                          ? ' • Team Head'
                          : m.role === 'teamAssistant'
                          ? ' • Team Assistant'
                          : '';
                      const usernameTag = m.username ? ` (@${m.username})` : '';
                      return (
                        <option key={m._id} value={m._id}>
                          {m.name}{usernameTag}{roleTag}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>

              {/* Status feedback helpers */}
              {loadingMembers && (
                <p className="mt-1 text-xs text-slate-500 animate-pulse">
                  Loading eligible team accounts...
                </p>
              )}
              {!loadingMembers && selectedTeamId && teamMembers.length === 0 && !membersError && (
                <p className="mt-1 text-xs text-amber-600">
                  No active members, heads, or assistants found assigned to this team.
                </p>
              )}
              {membersError && (
                <div className="mt-1 flex items-center justify-between text-xs text-rose-600">
                  <span>{membersError}</span>
                  <button
                    type="button"
                    onClick={() => setMembersReloadKey((k) => k + 1)}
                    className="ml-2 font-semibold underline hover:text-rose-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section: Criteria Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Activity Criteria <span className="text-rose-500">*</span>
            </label>
            <select
              value={criteriaId}
              onChange={(e) => setCriteriaId(e.target.value)}
              required
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">-- Select activity or penalty --</option>
              {CATEGORY_ORDER.map((catKey) => {
                const items = groupedCriteria[catKey] || [];
                if (items.length === 0) return null;
                return (
                  <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                    {items.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name} ({c.points > 0 ? `+${c.points}` : c.points} pts • {c.basisLabel})
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* Points Preview Badge */}
          {selectedCriteria && (
            <div
              className={`rounded-xl border p-4 flex items-center justify-between transition ${
                isNegative ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-700">Calculated score:</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basis: {selectedCriteria.basisLabel} • Frequency: {selectedCriteria.frequency}
                </p>
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  isNegative ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {previewPoints > 0 ? `+${previewPoints}` : previewPoints} pts
              </div>
            </div>
          )}

          {/* Section: Quantity & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showQuantity ? (
              <Input
                label={`Quantity (${selectedCriteria?.basisLabel})`}
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
              />
            ) : (
              <Input
                label="Quantity"
                type="text"
                value="1 (Fixed by criteria)"
                disabled
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Activity Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={getTodayDateString()}
                  required
                  className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
                />
              </div>
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
            required={Boolean(selectedCriteria?.needsProof)}
            disabled={submitting}
          />

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Note / Reference (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional details, visitor name, or context..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 p-3 text-base md:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600 resize-none"
            />
          </div>

          {/* Auto-Approval Notice */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Admin entries are automatically approved and immediately reflected on leaderboards.</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/entries')}
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
              {uploadingProof ? 'Uploading photo...' : 'Submit & Auto-Approve'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminNewEntry;
