import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusCircle } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import EntriesTable from '../../components/EntriesTable';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import PeriodPointsView from '../../components/PeriodPointsView';

const PAGE_SIZE = 15;

const AssistantSubmissions = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'period'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/entries', { params });
      // Only keep entries submitted by this assistant
      const allEntries = res.data.data || [];
      const myEntries = allEntries.filter(
        (e) => e.enteredBy?._id === user?._id || e.enteredBy === user?._id
      );

      setEntries(myEntries);
      setCurrentPage(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load your submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, user?._id]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="My recorded submissions"
        subtitle="Track the approval status of member point entries you have submitted."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <Link to="/assistant/entries/new">
              <Button variant="primary" size="sm" icon={PlusCircle} className="w-full sm:w-auto">
                Submit Activity
              </Button>
            </Link>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 w-full sm:w-auto border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('my')}
                className={`flex-1 sm:flex-initial min-h-[44px] md:min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'my'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My submissions
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

      {/* Period View or Submissions List */}
      {activeTab === 'period' ? (
        <PeriodPointsView isAdmin={false} />
      ) : (
        <>
          {/* Filter Bar */}
          <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: '', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`h-11 min-h-[44px] rounded-lg px-3.5 text-xs font-semibold capitalize transition ${
                  statusFilter === st.key
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 tabular-nums">
            Total: <strong className="text-slate-800">{entries.length}</strong> entries
          </span>
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
          emptyMessage="You have not submitted any entries matching this filter."
        />
      </Card>
      </>
      )}
    </div>
  );
};

export default AssistantSubmissions;
