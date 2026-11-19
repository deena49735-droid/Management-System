import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EntriesTable from '../../components/EntriesTable';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import SearchBar from '../../components/SearchBar';
import PeriodPointsView from '../../components/PeriodPointsView';

const PAGE_SIZE = 15;

const HeadHistory = () => {
  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'team' | 'period'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = activeTab === 'member' ? '/entries' : '/team-entries';
      const params = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await api.get(endpoint, { params });
      const dataList = res.data.data || [];
      setEntries(dataList);

      const total = res.data.pagination?.total ?? dataList.length;
      const pages = res.data.pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE) ?? 1;
      setTotalItems(total);
      setTotalPages(pages);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch team entries history.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, monthFilter, yearFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    if (activeTab !== 'period') {
      fetchHistory();
    }
  }, [fetchHistory, activeTab]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setDebouncedSearch(val.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch || statusFilter || monthFilter || (yearFilter && yearFilter !== new Date().getFullYear().toString())
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('');
    setMonthFilter('');
    setYearFilter(new Date().getFullYear().toString());
    setCurrentPage(1);
  };

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
                onClick={() => handleTabChange('member')}
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
                onClick={() => handleTabChange('team')}
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
                onClick={() => handleTabChange('period')}
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
          <Card className="p-4 space-y-3">
            {/* Search Bar Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SearchBar
                value={searchQuery}
                onChange={handleSearchChange}
                onClear={handleClearSearch}
                debounceMs={300}
                placeholder={
                  activeTab === 'member'
                    ? 'Search member name, username, or criterion...'
                    : 'Search criterion, note, or submitter...'
                }
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 shrink-0 min-h-[44px] px-2 flex items-center justify-center sm:justify-start"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Dropdowns Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                  />
                </div>
              ) : null
            }
          >
            <EntriesTable
              entries={entries}
              loading={loading}
              emptyMessage={
                debouncedSearch
                  ? `No ${activeTab} history found matching "${debouncedSearch}".`
                  : `No ${activeTab} history found matching your filters.`
              }
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default HeadHistory;

