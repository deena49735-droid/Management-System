import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';
import RejectModal from '../../components/RejectModal';
import Pagination from '../../components/Pagination';

const PAGE_SIZE = 15;

const AdminEntries = () => {
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'team'
  const [entries, setEntries] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTeam, setSelectedTeam] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejecting, setRejecting] = useState(false);

  // Fetch teams for filter dropdown
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/teams');
        setTeams(res.data.data || []);
      } catch (err) {
        console.error('Failed to load teams for filter:', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch entries based on active tab and filters
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const endpoint = activeTab === 'member' ? '/entries' : '/team-entries';
      const params = {};
      if (selectedTeam) params.team = selectedTeam;
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;

      const res = await api.get(endpoint, { params });
      setEntries(res.data.data || []);
      setCurrentPage(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [activeTab, selectedTeam, statusFilter, monthFilter, yearFilter]);

  // Client-side pagination
  const totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  // Handle Approve
  const handleApprove = async (entry) => {
    try {
      setActionLoadingId(entry._id);
      const endpoint = activeTab === 'member'
        ? `/entries/${entry._id}/approve`
        : `/team-entries/${entry._id}/approve`;

      const res = await api.patch(endpoint);
      toast.success(res.data.message || 'Entry approved successfully.');
      setEntries((prev) =>
        prev.map((e) => (e._id === entry._id ? res.data.data : e))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve entry.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject Modal Confirm
  const handleRejectConfirm = async (reason) => {
    if (!rejectItem) return;
    try {
      setRejecting(true);
      const endpoint = activeTab === 'member'
        ? `/entries/${rejectItem._id}/reject`
        : `/team-entries/${rejectItem._id}/reject`;

      const res = await api.patch(endpoint, { reason });
      toast.success(res.data.message || 'Entry rejected.');
      setEntries((prev) =>
        prev.map((e) => (e._id === rejectItem._id ? res.data.data : e))
      );
      setRejectItem(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject entry.');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          All Point Entries
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve, or override member activity and team bonus point entries.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('member')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'member'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Member Entries</span>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'team'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Team Monthly / Bonus Entries</span>
        </button>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
            Filter by Team
          </label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
            Month
          </label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
            Year
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Years</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
      </div>

      {/* Entries Table */}
      <EntriesTable
        entries={paginatedEntries}
        loading={loading}
        emptyMessage={`No ${activeTab} entries found matching your filters.`}
        renderActions={(entry) => {
          const isLoading = actionLoadingId === entry._id;
          return (
            <div className="flex items-center gap-1.5">
              {entry.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprove(entry)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setRejectItem(entry)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {entry.status === 'approved' && (
                <button
                  onClick={() => setRejectItem(entry)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                  title="Admin Override: Reject an already approved entry"
                >
                  Override Reject
                </button>
              )}

              {entry.status === 'rejected' && (
                <button
                  onClick={() => handleApprove(entry)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
                  title="Admin Override: Re-approve a rejected entry"
                >
                  Override Approve
                </button>
              )}
            </div>
          );
        }}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Reject Modal */}
      <RejectModal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        onConfirm={handleRejectConfirm}
        title={
          rejectItem?.status === 'approved'
            ? 'Override & Reject Approved Entry'
            : 'Reject Point Entry'
        }
        itemDescription={
          rejectItem && (
            <div>
              <p className="font-semibold text-slate-800">
                {rejectItem.criteria?.name} ({rejectItem.points} pts)
              </p>
              <p className="text-slate-500 mt-0.5">
                For: {rejectItem.member?.name || rejectItem.team?.name || 'Team'}
              </p>
            </div>
          )
        }
        loading={rejecting}
      />
    </div>
  );
};

export default AdminEntries;

