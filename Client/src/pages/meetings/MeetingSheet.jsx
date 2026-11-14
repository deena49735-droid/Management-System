import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import MeetingMemberRow from '../../components/meetings/MeetingMemberRow';
import ActivityPickerModal from '../../components/meetings/ActivityPickerModal';
import Badge from '../../components/Badge';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { SkeletonCard } from '../../components/Skeleton';

const EARLY_BIRD_TIME = '07:25';
const LATE_AFTER = '07:59';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const MeetingSheet = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Allowed activities for the picker
  const [allowedActivities, setAllowedActivities] = useState([]);
  const [pickerState, setPickerState] = useState({
    isOpen: false,
    memberId: null,
    memberName: '',
  });

  // Modal dialog states
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isSendBackModalOpen, setIsSendBackModalOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState('');

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/meetings/${id}`);
      const data = res.data.data;
      setMeeting(data);
      setRows(data.rows || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load meeting sheet.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllowedActivities = async () => {
    try {
      const res = await api.get('/meetings/allowed-activities');
      setAllowedActivities(res.data.data || []);
    } catch (err) {
      console.error('Failed to load allowed activities:', err);
    }
  };

  useEffect(() => {
    fetchMeeting();
    fetchAllowedActivities();
  }, [id]);

  // Determine read-only mode:
  const isEditable =
    (user?.role === 'teamAssistant' || user?.role === 'admin') && meeting?.status === 'draft';
  const isReadOnly = !isEditable;

  // Local live derivation of row points and summary
  const derivedSummary = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let totalPoints = 0;
    let penaltyCount = 0;

    const rowMap = new Map();

    (rows || []).forEach((row) => {
      const memberId = row.member?._id || row.member;
      const attendance = row.attendance || 'present';
      const arrivalTime = row.arrivalTime ? row.arrivalTime.trim() : '';
      const items = [];

      if (attendance === 'absent') {
        absentCount += 1;
        penaltyCount += 1;
        items.push({
          name: 'Absent for Weekly BNI Meeting',
          points: -100,
          type: 'penalty',
        });
      } else {
        if (attendance === 'present') presentCount += 1;
        else if (attendance === 'late') lateCount += 1;

        // Arrival time
        if (arrivalTime) {
          if (arrivalTime <= EARLY_BIRD_TIME) {
            items.push({
              name: 'Early Bird @ 7:25 AM',
              points: 20,
              type: 'bonus',
            });
          } else if (arrivalTime > LATE_AFTER) {
            penaltyCount += 1;
            items.push({
              name: 'Late after 7:59 AM',
              points: -100,
              type: 'penalty',
            });
          }
        } else if (attendance === 'late') {
          penaltyCount += 1;
          items.push({
            name: 'Late after 7:59 AM',
            points: -100,
            type: 'penalty',
          });
        }

        // Walked out
        if (row.walkedOut) {
          penaltyCount += 1;
          items.push({
            name: 'Walking Out During Meeting',
            points: -300,
            type: 'penalty',
          });
        }

        // Attire
        if (row.attire === 'full') {
          items.push({
            name: 'Full Attire (Tie + Pin + Badge)',
            points: 10,
            type: 'bonus',
          });
        } else if (row.attire === 'missing_pin_badge') {
          penaltyCount += 1;
          items.push({
            name: 'Missing Pin & Badge',
            points: -100,
            type: 'penalty',
          });
        }

        // Custom activities
        (row.activities || []).forEach((act) => {
          const crit = act.criteria;
          const critId = crit?._id || crit;
          const matchedCrit = allowedActivities.find((a) => a._id === critId) || crit;
          if (matchedCrit) {
            const qty = act.quantity || 1;
            const pts = (matchedCrit.points || 0) * qty;
            if (pts < 0) penaltyCount += 1;
            items.push({
              criteria: matchedCrit,
              name: matchedCrit.name,
              quantity: qty,
              points: pts,
              type: 'activity',
            });
          }
        });
      }

      const subtotal = items.reduce((acc, it) => acc + it.points, 0);
      totalPoints += subtotal;

      rowMap.set(memberId?.toString(), { items, subtotal });
    });

    return {
      presentCount,
      lateCount,
      absentCount,
      penaltyCount,
      totalPoints,
      rowMap,
    };
  }, [rows, allowedActivities]);

  // Handlers for Row mutations
  const handleRowChange = (updatedRow) => {
    const updatedMemberId = updatedRow.member?._id || updatedRow.member;
    setRows((prev) =>
      prev.map((r) => {
        const id = r.member?._id || r.member;
        return id?.toString() === updatedMemberId?.toString() ? updatedRow : r;
      })
    );
  };

  const handleMarkAllPresent = () => {
    if (!isEditable) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        attendance: 'present',
      }))
    );
    toast.success('Marked all members as present.');
  };

  // Activity Picker Handlers
  const handleOpenActivityPicker = (memberRef, name) => {
    const memberId = memberRef?._id || memberRef;
    setPickerState({
      isOpen: true,
      memberId,
      memberName: name,
    });
  };

  const handleAddActivity = (criteriaDoc, quantity) => {
    if (!pickerState.memberId) return;

    setRows((prev) =>
      prev.map((r) => {
        const id = r.member?._id || r.member;
        if (id?.toString() === pickerState.memberId?.toString()) {
          const currentActs = r.activities || [];
          const existingIdx = currentActs.findIndex(
            (a) => (a.criteria?._id || a.criteria)?.toString() === criteriaDoc._id.toString()
          );

          let updatedActs;
          if (existingIdx >= 0) {
            updatedActs = [...currentActs];
            updatedActs[existingIdx] = {
              ...updatedActs[existingIdx],
              quantity: Number(quantity) || 1,
            };
          } else {
            updatedActs = [
              ...currentActs,
              {
                criteria: criteriaDoc,
                quantity: Number(quantity) || 1,
              },
            ];
          }

          return { ...r, activities: updatedActs };
        }
        return r;
      })
    );
  };

  const handleRemoveActivity = (memberRef, criteriaId) => {
    const memberId = memberRef?._id || memberRef;
    setRows((prev) =>
      prev.map((r) => {
        const id = r.member?._id || r.member;
        if (id?.toString() === memberId?.toString()) {
          return {
            ...r,
            activities: (r.activities || []).filter(
              (a) => (a.criteria?._id || a.criteria)?.toString() !== criteriaId?.toString()
            ),
          };
        }
        return r;
      })
    );
  };

  // Save Draft (PUT)
  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      const res = await api.put(`/meetings/${id}`, {
        rows: rows.map((r) => ({
          member: r.member?._id || r.member,
          arrivalTime: r.arrivalTime || '',
          attendance: r.attendance || 'present',
          walkedOut: Boolean(r.walkedOut),
          attire: r.attire || 'none',
          activities: (r.activities || []).map((a) => ({
            criteria: a.criteria?._id || a.criteria,
            quantity: Number(a.quantity) || 1,
          })),
        })),
      });

      setMeeting(res.data.data);
      setRows(res.data.data.rows || []);
      toast.success('Meeting sheet draft saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save meeting sheet.');
    } finally {
      setSaving(false);
    }
  };

  // Submit Meeting (POST /submit)
  const handleSubmitConfirm = async () => {
    try {
      setSubmitting(true);
      await api.put(`/meetings/${id}`, {
        rows: rows.map((r) => ({
          member: r.member?._id || r.member,
          arrivalTime: r.arrivalTime || '',
          attendance: r.attendance || 'present',
          walkedOut: Boolean(r.walkedOut),
          attire: r.attire || 'none',
          activities: (r.activities || []).map((a) => ({
            criteria: a.criteria?._id || a.criteria,
            quantity: Number(a.quantity) || 1,
          })),
        })),
      });

      const res = await api.post(`/meetings/${id}/submit`);
      toast.success(res.data.message || 'Meeting sheet submitted for approval!');
      setIsSubmitModalOpen(false);
      fetchMeeting();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit meeting sheet.');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Meeting (POST /approve)
  const handleApproveConfirm = async () => {
    try {
      setApproving(true);
      const res = await api.post(`/meetings/${id}/approve`);
      toast.success(res.data.message || 'Meeting sheet approved.');
      setIsApproveModalOpen(false);
      fetchMeeting();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve meeting sheet.');
    } finally {
      setApproving(false);
    }
  };

  // Send Back Meeting (POST /send-back)
  const handleSendBackConfirm = async () => {
    if (!sendBackReason.trim()) {
      toast.error('A send-back reason is required.');
      return;
    }
    try {
      setSendingBack(true);
      const res = await api.post(`/meetings/${id}/send-back`, {
        reason: sendBackReason.trim(),
      });
      toast.success(res.data.message || 'Meeting sheet sent back to draft.');
      setIsSendBackModalOpen(false);
      setSendBackReason('');
      fetchMeeting();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send back meeting sheet.');
    } finally {
      setSendingBack(false);
    }
  };

  // Filter rows by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    return rows.filter((r) => {
      const name = r.member?.name || '';
      const username = r.member?.username || '';
      return (
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [rows, searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={4} />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-8 text-center text-slate-600">
        Meeting sheet not found.
      </div>
    );
  }

  const basePath =
    user?.role === 'admin'
      ? '/admin/meetings'
      : user?.role === 'teamHead'
      ? '/head/meetings'
      : '/assistant/meetings';

  return (
    <div className="space-y-6 pb-28 sm:pb-24">
      {/* Header with Back button */}
      <PageHeader
        backTo={basePath}
        title={`Weekly meeting sheet · ${formatDate(meeting.date)}`}
        subtitle={`${meeting.team?.name || 'Team meeting'} · Week ${meeting.weekNumber} · Month ${meeting.month}/${meeting.year}`}
        badge={<Badge status={meeting.status} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {derivedSummary.presentCount} Present
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {derivedSummary.lateCount} Late
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-700 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {derivedSummary.absentCount} Absent
            </span>
          </div>
        }
      />

      {/* Send-back alert if present */}
      {meeting.sendBackReason && meeting.status === 'draft' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Sent back for revision</span>
          </div>
          <p className="pl-6 text-slate-700 italic">
            "{meeting.sendBackReason}"
          </p>
        </div>
      )}

      {/* Self-approval pending notice for Team Head */}
      {meeting.status === 'submitted' && meeting.ledgerStatus?.headPendingCount > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/80 p-4 text-xs text-brand-900 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-brand-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Self-approval notice</span>
          </div>
          <p className="pl-6 text-brand-800">
            {meeting.ledgerStatus.headPendingCount} point {meeting.ledgerStatus.headPendingCount === 1 ? 'entry' : 'entries'} belong to you as Team Head. Per Stage 1A rules, team entries can be approved, but your own entry requires Admin approval.
          </p>
        </div>
      )}

      {/* Search Bar & Quick Action */}
      <Card className="p-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member in sheet..."
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-base md:text-sm text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          {isEditable && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={CheckCircle2}
              onClick={handleMarkAllPresent}
              className="w-full sm:w-auto"
            >
              Mark all present
            </Button>
          )}
        </div>
      </Card>

      {/* Member Rows */}
      <div className="space-y-3.5">
        {filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No members match your search.
          </div>
        ) : (
          filteredRows.map((row) => {
            const memberId = row.member?._id || row.member;
            const derivedInfo = derivedSummary.rowMap.get(memberId?.toString());

            return (
              <MeetingMemberRow
                key={memberId?.toString()}
                row={row}
                onChange={handleRowChange}
                onOpenActivityPicker={handleOpenActivityPicker}
                onRemoveActivity={handleRemoveActivity}
                derivedInfo={derivedInfo}
                isReadOnly={isReadOnly}
              />
            );
          })
        )}
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-6 shadow-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pl-60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          {/* Total Points Live Display */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Meeting total
            </p>
            <p
              className={`text-lg sm:text-xl font-bold tabular-nums ${
                derivedSummary.totalPoints < 0
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }`}
            >
              {derivedSummary.totalPoints < 0
                ? derivedSummary.totalPoints
                : `+${derivedSummary.totalPoints}`}{' '}
              pts
            </p>
          </div>

          {/* Action Buttons depending on role and status */}
          <div className="flex items-center gap-2">
            {isEditable && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting}
                  isLoading={saving}
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setIsSubmitModalOpen(true)}
                  disabled={saving || submitting}
                >
                  Submit sheet
                </Button>
              </>
            )}

            {/* Review mode for Team Head and Admin when submitted */}
            {meeting.status === 'submitted' &&
              (user?.role === 'teamHead' || user?.role === 'admin') && (
                <>
                  <Button
                    type="button"
                    variant="outlineDanger"
                    onClick={() => setIsSendBackModalOpen(true)}
                    disabled={sendingBack || approving}
                  >
                    Send back
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={() => setIsApproveModalOpen(true)}
                    disabled={sendingBack || approving}
                  >
                    Approve sheet
                  </Button>
                </>
              )}
          </div>
        </div>
      </div>

      {/* Activity Picker Modal */}
      <ActivityPickerModal
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState({ isOpen: false, memberId: null, memberName: '' })}
        activities={allowedActivities}
        onAddActivity={handleAddActivity}
        memberName={pickerState.memberName}
      />

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit meeting sheet for approval?"
        subtitle="Submitting this sheet will generate point entries for Team Head review."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Attendance:</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {derivedSummary.presentCount} Present • {derivedSummary.lateCount} Late • {derivedSummary.absentCount} Absent
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total net points:</span>
              <span
                className={`font-bold tabular-nums ${
                  derivedSummary.totalPoints < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {derivedSummary.totalPoints} pts
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Negative penalties:</span>
              <span className="font-semibold tabular-nums text-rose-600">
                {derivedSummary.penaltyCount} penalties
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              onClick={handleSubmitConfirm}
              isLoading={submitting}
            >
              Confirm and submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve meeting sheet?"
        subtitle="Approving this sheet will post all derived points to the official ledger."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold text-slate-800">{formatDate(meeting.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total net points:</span>
              <span
                className={`font-bold tabular-nums ${
                  derivedSummary.totalPoints < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {derivedSummary.totalPoints} pts
              </span>
            </div>
          </div>

          {user?.role === 'teamHead' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
              Note: Under Stage 1A self-approval rules, your own entries cannot be approved by yourself and will remain pending for Admin approval.
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={approving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={handleApproveConfirm}
              isLoading={approving}
            >
              Confirm approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Back Reason Modal */}
      <Modal
        isOpen={isSendBackModalOpen}
        onClose={() => {
          setIsSendBackModalOpen(false);
          setSendBackReason('');
        }}
        title="Send back meeting sheet"
        subtitle="Provide a clear reason so the team assistant can correct the attendance sheet."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={sendBackReason}
            onChange={(e) => setSendBackReason(e.target.value)}
            placeholder="Enter mandatory reason for sending back..."
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-base md:text-xs text-slate-800 placeholder-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-100 transition"
          />

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsSendBackModalOpen(false);
                setSendBackReason('');
              }}
              disabled={sendingBack}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleSendBackConfirm}
              isLoading={sendingBack}
              disabled={!sendBackReason.trim()}
            >
              Confirm send back
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingSheet;
