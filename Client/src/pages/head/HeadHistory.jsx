import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';

const PAGE_SIZE = 15;

const HeadHistory = () => {
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'team'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const endpoint = activeTab === 'member' ? '/entries' : '/team-entries';
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;

      const res = await api.get(endpoint, { params });
      setEntries(res.data.data || []);
      setCurrentPage(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch team entries history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeTab, statusFilter, monthFilter, yearFilter]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Team Points History"
        subtitle="Search and inspect all historical member activity and team bonus point entries."
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('member')}
              className={`flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'member'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Member Entries
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'team'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team Monthly / Bonus Entries
            </button>
          </div>
        }
      />

      {/* Filters Card */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Month
            </label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Year
            </label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Entries Table */}
      <Card>
        <Card.Body className="p-0">
          <EntriesTable
            entries={paginatedEntries}
            loading={loading}
            emptyMessage={`No ${activeTab} history found matching your filters.`}
          />
        </Card.Body>
        {totalPages > 1 && (
          <Card.Footer className="flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </Card.Footer>
        )}
      </Card>
    </div>
  );
};

export default HeadHistory;
