import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Calendar, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/Badge';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const MeetingsList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (monthFilter) params.month = monthFilter;
      if (yearFilter) params.year = yearFilter;

      const res = await api.get('/meetings', { params });
      setMeetings(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load meeting sheets.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamsForAdmin = async () => {
    if (user?.role === 'admin') {
      try {
        const res = await api.get('/teams');
        setTeams(res.data.data || []);
      } catch (err) {
        console.error('Failed to load teams:', err);
      }
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [statusFilter, monthFilter, yearFilter]);

  useEffect(() => {
    fetchTeamsForAdmin();
  }, [user?.role]);

  const basePath =
    user?.role === 'admin'
      ? '/admin/meetings'
      : user?.role === 'teamHead'
      ? '/head/meetings'
      : '/assistant/meetings';

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedDate) {
      toast.error('Meeting date is required.');
      return;
    }

    if (user?.role === 'admin' && !selectedTeamId) {
      toast.error('Please select a team.');
      return;
    }

    try {
      setCreating(true);
      const payload = {
        date: selectedDate,
      };
      if (user?.role === 'admin') {
        payload.teamId = selectedTeamId;
      }

      const res = await api.post('/meetings', payload);
      toast.success('Meeting sheet created as Draft!');
      setIsCreateModalOpen(false);
      const newId = res.data.data._id;
      navigate(`${basePath}/${newId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create meeting sheet.');
    } finally {
      setCreating(false);
    }
  };

  const canCreate = user?.role === 'teamAssistant' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Meeting attendance sheets"
        subtitle="Weekly chapter meeting sheets, attendance records, and meeting day points."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              New meeting sheet
            </Button>
          ) : undefined
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>

          {/* Month Filter */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
          >
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-10 min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
          >
            <option value="">All years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          {(statusFilter || monthFilter || yearFilter) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setMonthFilter('');
                setYearFilter('');
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 ml-auto h-10 min-h-[40px] px-2 flex items-center"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Meetings List */}
      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No meeting sheets found"
          description="Meeting attendance records will appear here once created."
          actionLabel={canCreate ? 'Create a meeting sheet' : undefined}
          onAction={canCreate ? () => setIsCreateModalOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {/* Mobile Cards (Below 768px: clean cards, no horizontal scroll) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {meetings.map((m) => (
              <div
                key={m._id}
                onClick={() => navigate(`${basePath}/${m._id}`)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition cursor-pointer space-y-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{formatDate(m.date)}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m.team?.name ? `${m.team.name} • ` : ''}Week {m.weekNumber}
                    </p>
                  </div>
                  <Badge status={m.status} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <span className="text-emerald-700 font-semibold">{m.presentCount}P</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-amber-700 font-semibold">{m.lateCount}L</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-rose-700 font-semibold">{m.absentCount}A</span>
                  </div>

                  <span
                    className={`font-bold tabular-nums ${
                      m.totalPoints < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {m.totalPoints < 0 ? m.totalPoints : `+${m.totalPoints}`} pts
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>By: {m.submittedBy?.name || m.createdBy?.name || 'Assistant'}</span>
                  <span className="font-semibold text-brand-600 inline-flex items-center gap-1">
                    Open sheet <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= 768px) */}
          <Card className="hidden md:block overflow-hidden p-0">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Meeting date</th>
                  {user?.role === 'admin' && <th className="px-5 py-3.5">Team</th>}
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-center">Attendance (P / L / A)</th>
                  <th className="px-4 py-3.5 text-right">Net points</th>
                  <th className="px-5 py-3.5">Created / Submitted by</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <span>{formatDate(m.date)}</span>
                      <span className="block text-xs font-normal text-slate-400">
                        Week {m.weekNumber} • Month {m.month}/{m.year}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {m.team?.name || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      <Badge status={m.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-medium tabular-nums">
                      <span className="text-emerald-700 font-semibold">{m.presentCount} Present</span>
                      {' • '}
                      <span className="text-amber-700 font-semibold">{m.lateCount} Late</span>
                      {' • '}
                      <span className="text-rose-700 font-semibold">{m.absentCount} Absent</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${
                          m.totalPoints < 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {m.totalPoints < 0 ? m.totalPoints : `+${m.totalPoints}`} pts
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      <span>{m.submittedBy?.name || m.createdBy?.name || 'System'}</span>
                      {m.submittedAt && (
                        <span className="block text-[11px] text-slate-400">
                          {formatDate(m.submittedAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`${basePath}/${m._id}`)}
                      >
                        {m.status === 'draft' && canCreate
                          ? 'Edit sheet'
                          : m.status === 'submitted' &&
                            (user?.role === 'teamHead' || user?.role === 'admin')
                          ? 'Review sheet'
                          : 'View sheet'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Create New Meeting Sheet Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create new meeting sheet"
        subtitle="Select the meeting date. Members of the team will be pre-populated automatically."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Meeting date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          {/* Team Selector if Admin */}
          {user?.role === 'admin' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select team <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              >
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={creating}
            >
              Create draft sheet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MeetingsList;
