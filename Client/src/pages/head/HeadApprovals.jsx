import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import EntriesTable from '../../components/EntriesTable';
import RejectModal from '../../components/RejectModal';

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Pending Approvals
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and approve point entries submitted for your team.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('member')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'member'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Member Entries</span>
          {memberEntries.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {memberEntries.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'team'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Team Monthly Points</span>
          {teamEntries.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {teamEntries.length}
            </span>
          )}
        </button>
      </div>

      {/* Table of Entries */}
      <EntriesTable
        entries={currentList}
        loading={loading}
        prominentProof={true}
        emptyMessage={`No pending ${activeTab === 'member' ? 'member' : 'team'} entries awaiting approval.`}
        renderActions={(entry) => {
          const isSelf = activeTab === 'member' && entry.member?._id === user?._id;
          const isActing = actionLoadingId === entry._id;

          if (isSelf) {
            return (
              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                Self-entry (Admin approval needed)
              </span>
            );
          }

          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(entry, activeTab === 'team')}
                disabled={isActing}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50"
              >
                {isActing ? '...' : 'Approve'}
              </button>
              <button
                onClick={() => setRejectItem(entry)}
                disabled={isActing}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          );
        }}
      />

      {/* Reject Reason Modal */}
      <RejectModal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        onConfirm={handleRejectConfirm}
        title="Reject Point Entry"
        itemDescription={
          rejectItem && (
            <div>
              <p className="font-semibold text-slate-800">
                {rejectItem.criteria?.name} ({rejectItem.points} pts)
              </p>
              <p className="text-slate-500 mt-0.5">
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

