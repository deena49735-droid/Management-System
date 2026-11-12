import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';

const AdminTeams = () => {
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add Team Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/teams');
      if (res.data?.success) {
        setTeams(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
      toast.error(err.response?.data?.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Filtered teams list
  const filteredTeams = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesStatus =
      statusFilter === ''
        ? true
        : statusFilter === 'true'
        ? t.isActive
        : !t.isActive;
    return matchesSearch && matchesStatus;
  });

  const handleAddTeamSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmed = teamName.trim();
    if (!trimmed) {
      setFormError('Team name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/teams', { name: trimmed });
      toast.success('Team created successfully!');
      setIsAddModalOpen(false);
      setTeamName('');
      fetchTeams();

      // Navigate to the newly created team's detail page
      if (res.data?.data?._id) {
        navigate(`/admin/teams/${res.data.data._id}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create team.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Team Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create chapter teams, assign leadership positions, and manage member rosters.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setTeamName('');
            setIsAddModalOpen(true);
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 transition"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Team</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search teams by name..."
            className="w-full min-h-[40px] rounded-xl border border-slate-300 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-xs sm:text-sm text-slate-700 bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
        >
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Teams List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Loading teams...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-3 text-base font-semibold text-slate-800">No teams found</p>
            <p className="mt-1 text-sm text-slate-500">
              {searchTerm || statusFilter
                ? 'Try adjusting your search query or filter options.'
                : 'Click "Add Team" above to create your first team.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Team Name</th>
                    <th scope="col" className="px-6 py-3.5">Team Lead</th>
                    <th scope="col" className="px-6 py-3.5">Team Assistant</th>
                    <th scope="col" className="px-6 py-3.5 text-center">Members</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeams.map((team) => (
                    <tr
                      key={team._id}
                      onClick={() => navigate(`/admin/teams/${team._id}`)}
                      className="cursor-pointer hover:bg-slate-50/70 transition"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {team.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {team.lead ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{team.lead.name}</span>
                            <span className="text-xs text-slate-400">({team.lead.phone})</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {team.assistant ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{team.assistant.name}</span>
                            <span className="text-xs text-slate-400">({team.assistant.phone})</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                          {team.memberCount || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge status={team.isActive} />
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 text-xs">
                          Manage &rarr;
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTeams.map((team) => (
                <div
                  key={team._id}
                  onClick={() => navigate(`/admin/teams/${team._id}`)}
                  className="p-4 space-y-3 active:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{team.name}</h3>
                    <Badge status={team.isActive} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Team Lead</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                        {team.lead?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Assistant</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                        {team.assistant?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-slate-500">
                      Roster: <strong className="text-slate-800">{team.memberCount || 0} members</strong>
                    </span>
                    <span className="text-xs font-bold text-indigo-600">
                      View Details &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddTeamSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Team Name *
            </label>
            <input
              type="text"
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Phoenix Warriors"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminTeams;

