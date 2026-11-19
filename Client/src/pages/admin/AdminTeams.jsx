import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Users, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';
import SearchBar from '../../components/SearchBar';

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
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.name?.toLowerCase().includes(q) ||
      (t.head?.name && t.head.name.toLowerCase().includes(q)) ||
      (t.head?.username && t.head.username.toLowerCase().includes(q)) ||
      (t.assistant?.name && t.assistant.name.toLowerCase().includes(q)) ||
      (t.assistant?.username && t.assistant.username.toLowerCase().includes(q));
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
      <PageHeader
        title="Team management"
        subtitle="Create chapter teams, assign leadership positions, and manage member rosters."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setFormError('');
              setTeamName('');
              setIsAddModalOpen(true);
            }}
          >
            Add team
          </Button>
        }
      />

      {/* Search and Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search teams by name, head, or assistant..."
            className="flex-1"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </Card>

      {/* Teams List */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams found"
            description={
              searchTerm || statusFilter
                ? 'Try adjusting your search query or filter options.'
                : 'Click "Add team" above to create your first team.'
            }
          />
        ) : (
          <>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Team name</th>
                    <th scope="col" className="px-5 py-3.5">Team Head</th>
                    <th scope="col" className="px-5 py-3.5">Team Assistant</th>
                    <th scope="col" className="px-5 py-3.5 text-center">Members</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeams.map((team) => (
                    <tr
                      key={team._id}
                      onClick={() => navigate(`/admin/teams/${team._id}`)}
                      className="cursor-pointer hover:bg-slate-50/80 transition"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={team.name} size="xs" />
                          <span>{team.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                        {team.head ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{team.head.name}</span>
                            <span className="text-xs text-slate-400">@{team.head.username}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                        {team.assistant ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{team.assistant.name}</span>
                            <span className="text-xs text-slate-400">@{team.assistant.username}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
                          {team.memberCount || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge status={team.isActive} />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800">
                          Manage <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (Below 768px: clean cards, no horizontal scroll) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTeams.map((team) => (
                <div
                  key={team._id}
                  onClick={() => navigate(`/admin/teams/${team._id}`)}
                  className="p-4 space-y-3 active:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={team.name} size="sm" />
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm leading-snug">{team.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {team.memberCount || 0} roster members
                        </p>
                      </div>
                    </div>
                    <Badge status={team.isActive} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-xs uppercase font-semibold">Team Head</span>
                      <span className="font-medium text-slate-800 mt-0.5 block truncate">
                        {team.head ? team.head.name : 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-xs uppercase font-semibold">Assistant</span>
                      <span className="font-medium text-slate-800 mt-0.5 block truncate">
                        {team.assistant ? team.assistant.name : 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs font-semibold text-brand-600">
                    <span className="text-slate-400 font-normal">Tap to manage leadership & members</span>
                    <span className="inline-flex items-center gap-1">
                      Manage <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add new team"
        subtitle="Create a new chapter team"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddTeamSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <Input
            label="Team name"
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Phoenix Warriors"
            autoFocus
          />

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Create team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminTeams;
