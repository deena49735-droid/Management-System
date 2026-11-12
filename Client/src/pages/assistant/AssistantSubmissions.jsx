import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import EntriesTable from '../../components/EntriesTable';
import Pagination from '../../components/Pagination';

const PAGE_SIZE = 15;

const AssistantSubmissions = () => {
  const { user } = useAuth();
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          My Recorded Submissions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the approval status of member point entries you have submitted.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {['', 'pending', 'approved', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === '' ? 'All Statuses' : st}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500">
          Total: <strong className="text-slate-800">{entries.length}</strong> entries
        </span>
      </div>

      {/* Entries Table */}
      <EntriesTable
        entries={paginatedEntries}
        loading={loading}
        emptyMessage="You have not submitted any entries matching this filter."
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
    </div>
  );
};

export default AssistantSubmissions;

