import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useApprovals } from '../../context/ApprovalsContext';
import EntriesTable from '../../components/EntriesTable';
import RejectModal from '../../components/RejectModal';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';

const HeadApprovals = () => {
  const { user } = useAuth();
  const isAssistant = user?.role === 'teamAssistant';
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'team'
  const [memberEntries, setMemberEntries] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Global approvals context to keep sidebar and dashboards in sync
  const { decrementPendingCount, setPendingCount, refreshPendingCount } = useApprovals();

  // Rejection modal state
  const [rejectItem, setRejectItem] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPendingData = async () => {
    try {
      setLoading(true);
      if (isAssistant) {
        const memberRes = await api.get('/entries', {
          params: { status: 'pending', _t: Date.now() },
        });
        const mList = memberRes.data.data || [];
        setMemberEntries(mList);
        setTeamEntries([]);
        const actionable = mList.filter((e) => e.canActOnMine !== false);
        setPendingCount(actionable.length);
      } else {
        const [memberRes, teamRes] = await Promise.all([
          api.get('/entries', { params: { status: 'pending', _t: Date.now() } }),
          api.get('/team-entries', { params: { status: 'pending', _t: Date.now() } }),
        ]);
        const mList = memberRes.data.data || [];
        const tList = teamRes.data.data || [];
        setMemberEntries(mList);
        setTeamEntries(tList);
        setPendingCount(mList.length + tList.length);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch pending approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [isAssistant]);

  const handleApprove = async (entry, isTeam = false) => {
    if (actionLoadingId || rejecting) return; // Prevent double-clicks & concurrent actions

    try {
      setActionLoadingId(entry._id);
      const endpoint = isTeam
        ? `/team-entries/${entry._id}/approve`
        : `/entries/${entry._id}/approve`;

      await api.patch(endpoint);

      // 1. Immediately remove processed item from the pending list
      if (isTeam) {
        setTeamEntries((prev) => prev.filter((item) => item._id !== entry._id));
      } else {
        setMemberEntries((prev) => prev.filter((item) => item._id !== entry._id));
      }

      // 2. Immediately update sidebar badge count & dashboards
      decrementPendingCount(1);
      toast.success('Entry approved successfully!');

      // 3. Broadcast update to other components and silently refresh backend truth
      window.dispatchEvent(
        new CustomEvent('kadambas:approvals-changed', {
          detail: { id: entry._id, isTeam, action: 'approve' },
        })
      );
      refreshPendingCount();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response?.data?.message || 'This entry was already processed.');
        if (isTeam) {
          setTeamEntries((prev) => prev.filter((item) => item._id !== entry._id));
        } else {
          setMemberEntries((prev) => prev.filter((item) => item._id !== entry._id));
        }
        decrementPendingCount(1);
        refreshPendingCount();
      } else {
        toast.error(err.response?.data?.message || 'Failed to approve entry.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectItem || rejecting || actionLoadingId) return;

    const itemToReject = rejectItem;
    const isTeam = activeTab === 'team';

    try {
      setRejecting(true);
      const endpoint = isTeam
        ? `/team-entries/${itemToReject._id}/reject`
        : `/entries/${itemToReject._id}/reject`;

      await api.patch(endpoint, { reason });

      // 1. Immediately remove processed item from the pending list
      if (isTeam) {
        setTeamEntries((prev) => prev.filter((item) => item._id !== itemToReject._id));
      } else {
        setMemberEntries((prev) => prev.filter((item) => item._id !== itemToReject._id));
      }

      // 2. Immediately update sidebar badge count & dashboards
      decrementPendingCount(1);
      toast.success('Entry rejected.');
      setRejectItem(null);

      // 3. Broadcast update to other components and silently refresh backend truth
      window.dispatchEvent(
        new CustomEvent('kadambas:approvals-changed', {
          detail: { id: itemToReject._id, isTeam, action: 'reject' },
        })
      );
      refreshPendingCount();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error(err.response?.data?.message || 'This entry was already processed.');
        if (isTeam) {
          setTeamEntries((prev) => prev.filter((item) => item._id !== itemToReject._id));
        } else {
          setMemberEntries((prev) => prev.filter((item) => item._id !== itemToReject._id));
        }
        decrementPendingCount(1);
        setRejectItem(null);
        refreshPendingCount();
      } else {
        toast.error(err.response?.data?.message || 'Failed to reject entry.');
      }
    } finally {
      setRejecting(false);
    }
  };

  const currentList = activeTab === 'member' ? memberEntries : teamEntries;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Pending approvals"
        subtitle={
          isAssistant
            ? 'Review and approve member point entries submitted for your team.'
            : 'Review and approve point entries submitted for your team.'
        }
        actions={
          isAssistant ? null : (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('member')}
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] flex items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'member'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Member entries</span>
                {memberEntries.length > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 tabular-nums">
                    {memberEntries.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] flex items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'team'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Team points</span>
                {teamEntries.length > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 tabular-nums">
                    {teamEntries.length}
                  </span>
                )}
              </button>
            </div>
          )
        }
      />

      {/* Table of Entries in a Card */}
      <Card className="overflow-hidden p-0">
        <EntriesTable
          entries={currentList}
          loading={loading}
          prominentProof={true}
          emptyMessage={`No pending ${activeTab === 'member' ? 'member' : 'team'} entries awaiting approval.`}
          renderActions={(entry) => {
            const canAct =
              entry.canActOnMine !== undefined
                ? entry.canActOnMine
                : entry.member?._id !== user?._id &&
                  (entry.enteredBy?._id || entry.enteredBy) !== user?._id;

            const isActing = actionLoadingId === entry._id;
            const isProcessingAny = actionLoadingId !== null || rejecting;
            const isMeetingEntry = entry.source === 'meeting_sheet' && entry.meeting;
            const meetingId = entry.meeting?._id || entry.meeting;
            const meetingDateStr = entry.date
              ? new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '';

            return (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isMeetingEntry && (
                  <Link
                    to={isAssistant ? `/assistant/meetings/${meetingId}` : `/head/meetings/${meetingId}`}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition whitespace-nowrap"
                    title="View full meeting attendance sheet"
                  >
                    <span>Meeting {meetingDateStr}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}

                {!canAct ? (
                  <span className="inline-flex min-h-[32px] items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                    Waiting for another approver
                  </span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      disabled={isProcessingAny}
                      isLoading={isActing}
                      onClick={() => handleApprove(entry, activeTab === 'team')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outlineDanger"
                      disabled={isProcessingAny}
                      onClick={() => setRejectItem(entry)}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            );
          }}
        />
      </Card>

      {/* Reject Reason Modal */}
      <RejectModal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        onConfirm={handleRejectConfirm}
        title="Reject point entry"
        itemDescription={
          rejectItem && (
            <div>
              <p className="font-semibold text-slate-800">
                {rejectItem.criteria?.name} ({rejectItem.points > 0 ? `+${rejectItem.points}` : rejectItem.points} pts)
              </p>
              <p className="text-slate-500 mt-0.5 text-xs">
                Member: {rejectItem.member?.name ? `${rejectItem.member.name} (@${rejectItem.member.username})` : 'Whole Team'}
              </p>
            </div>
          )
        }
        loading={rejecting}
      />
    </div>
  );
};

export default HeadApprovals;
