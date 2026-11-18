import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import PeriodPointsView from '../../components/PeriodPointsView';

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
        title="Team points history"
        subtitle="Search and inspect all historical member activity and team bonus point entries."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <Link to="/head/entries/new">
              <Button variant="primary" size="sm" icon={PlusCircle} className="w-full sm:w-auto">
                Submit Activity
              </Button>
            </Link>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('member')}
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
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
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'team'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team monthly / bonus
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('period')}
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'period'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By date / period
              </button>
            </div>
          </div>
        }
      />

      {/* Period View or Ledger Table */}
      {activeTab === 'period' ? (
        <PeriodPointsView isAdmin={false} />
      ) : (
        <>
          {/* Filters Toolbar */}
          <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
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
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
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
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All years</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Entries Table */}
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
          emptyMessage={`No ${activeTab} history found matching your filters.`}
        />
      </Card>
      </>
      )}
    </div>
  );
};

export default HeadHistory;
