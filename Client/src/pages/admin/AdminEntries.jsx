import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';
import RejectModal from '../../components/RejectModal';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';

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
      const endpoint =
        activeTab === 'member'
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
      const endpoint =
        activeTab === 'member'
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
      <PageHeader
        title="All point entries"
        subtitle="Review, approve, or override member activity and team bonus point entries."
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('member')}
              className={`flex-1 sm:flex-initial min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'member'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Member entries
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex-1 sm:flex-initial min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'team'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team monthly / bonus
            </button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Filter by team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Month
            </label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Year
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Entries Table in Card */}
      <Card
        className="overflow-hidden p-0"
        footer={
          totalPages > 1 ? (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={entries.length}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : null
        }
      >
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
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleApprove(entry)}
                      isLoading={isLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlineDanger"
                      size="sm"
                      onClick={() => setRejectItem(entry)}
                      disabled={isLoading}
                    >
                      Reject
                    </Button>
                  </>
                )}

                {entry.status === 'approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejectItem(entry)}
                    disabled={isLoading}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    title="Admin override: Reject an already approved entry"
                  >
                    Override reject
                  </Button>
                )}

                {entry.status === 'rejected' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApprove(entry)}
                    isLoading={isLoading}
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    title="Admin override: Re-approve a rejected entry"
                  >
                    Override approve
                  </Button>
                )}
              </div>
            );
          }}
        />
      </Card>

      {/* Reject Modal */}
      <RejectModal
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        onConfirm={handleRejectConfirm}
        title={
          rejectItem?.status === 'approved'
            ? 'Override and reject entry'
            : 'Reject point entry'
        }
        itemDescription={
          rejectItem && (
            <div>
              <p className="font-semibold text-slate-800">
                {rejectItem.criteria?.name} ({rejectItem.points > 0 ? `+${rejectItem.points}` : rejectItem.points} pts)
              </p>
              <p className="text-slate-500 mt-0.5 text-xs">
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
