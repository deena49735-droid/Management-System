import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import EntriesTable from '../../components/EntriesTable';
import RejectModal from '../../components/RejectModal';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';

const HeadApprovals = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'team'
  const [memberEntries, setMemberEntries] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rejection modal state
  const [rejectItem, setRejectItem] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchPendingData = async () => {
    try {
      setLoading(true);
      const [memberRes, teamRes] = await Promise.all([
        api.get('/entries', { params: { status: 'pending' } }),
        api.get('/team-entries', { params: { status: 'pending' } }),
      ]);

      setMemberEntries(memberRes.data.data || []);
      setTeamEntries(teamRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch pending approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, []);

  const handleApprove = async (entry, isTeam = false) => {
    try {
      setActionLoadingId(entry._id);
      const endpoint = isTeam
        ? `/team-entries/${entry._id}/approve`
        : `/entries/${entry._id}/approve`;

      await api.patch(endpoint);
      toast.success('Entry approved successfully!');

      if (isTeam) {
        setTeamEntries((prev) => prev.filter((e) => e._id !== entry._id));
      } else {
        setMemberEntries((prev) => prev.filter((e) => e._id !== entry._id));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve entry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectItem) return;
    try {
      setRejecting(true);
      const isTeam = activeTab === 'team';
      const endpoint = isTeam
        ? `/team-entries/${rejectItem._id}/reject`
        : `/entries/${rejectItem._id}/reject`;

      await api.patch(endpoint, { reason });
      toast.success('Entry rejected.');

      if (isTeam) {
        setTeamEntries((prev) => prev.filter((e) => e._id !== rejectItem._id));
      } else {
        setMemberEntries((prev) => prev.filter((e) => e._id !== rejectItem._id));
      }
      setRejectItem(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject entry.');
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
        subtitle="Review and approve point entries submitted for your team."
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('member')}
              className={`flex-1 sm:flex-initial min-h-[36px] flex items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'member'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Member entries</span>
              {memberEntries.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700 tabular-nums">
                  {memberEntries.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex-1 sm:flex-initial min-h-[36px] flex items-center justify-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'team'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Team points</span>
              {teamEntries.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700 tabular-nums">
                  {teamEntries.length}
                </span>
              )}
            </button>
          </div>
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
            const isSelf = activeTab === 'member' && entry.member?._id === user?._id;
            const isActing = actionLoadingId === entry._id;
            const isMeetingEntry = entry.source === 'meeting_sheet' && entry.meeting;
            const meetingId = entry.meeting?._id || entry.meeting;
            const meetingDateStr = entry.date
              ? new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '';

            return (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isMeetingEntry && (
                  <Link
                    to={`/head/meetings/${meetingId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition whitespace-nowrap"
                    title="View full meeting attendance sheet"
                  >
                    <span>Meeting {meetingDateStr}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}

                {isSelf ? (
                  <Badge variant="warning">
                    Self-entry (Admin approval needed)
                  </Badge>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={isActing}
                      isLoading={isActing}
                      onClick={() => handleApprove(entry, activeTab === 'team')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outlineDanger"
                      disabled={isActing}
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
