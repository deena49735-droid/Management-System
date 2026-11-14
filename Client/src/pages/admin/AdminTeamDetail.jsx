import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Edit2, Plus, Users, UserCheck, Shield, Award } from 'lucide-react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Badge from '../../components/Badge';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonCard, SkeletonTable } from '../../components/Skeleton';

const AdminTeamDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit Name Modal State
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Confirm Deactivate/Activate Dialog State
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);

  // Assign Leadership States
  const [selectedHeadId, setSelectedHeadId] = useState('');
  const [selectedAssistantId, setSelectedAssistantId] = useState('');

  // Add Member State
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState('');

  // Remove Member Confirm State
  const [memberToRemove, setMemberToRemove] = useState(null);

  // Fetch Team and Users
  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamRes, usersRes] = await Promise.all([
        api.get(`/teams/${id}`),
        api.get('/users?isActive=true&limit=100'),
      ]);

      if (teamRes.data?.success) {
        setTeam(teamRes.data.data);
        setEditedName(teamRes.data.data.name);
        setSelectedHeadId(teamRes.data.data.head?._id || '');
        setSelectedAssistantId(teamRes.data.data.assistant?._id || '');
      }

      if (usersRes.data?.success) {
        setActiveUsers(usersRes.data.data.users || []);
      }
    } catch (err) {
      console.error('Error loading team details:', err);
      toast.error(err.response?.data?.message || 'Failed to load team.');
      navigate('/admin/teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Eligible users for Head & Assistant: active users who are either not in a team or already in THIS team
  const eligibleLeaders = activeUsers.filter((u) => {
    const userTeamId = u.team?._id || u.team;
    return !userTeamId || userTeamId.toString() === id;
  });

  // Eligible users to Add as Member: active users who are NOT in any team at all
  const eligibleNewMembers = activeUsers.filter((u) => {
    const userTeamId = u.team?._id || u.team;
    return !userTeamId;
  });

  // Edit Team Name
  const handleUpdateName = async (e) => {
    e.preventDefault();
    const trimmed = editedName.trim();
    if (!trimmed) {
      toast.error('Team name cannot be empty.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.put(`/teams/${id}`, { name: trimmed });
      toast.success('Team name updated!');
      setTeam((prev) => ({ ...prev, name: res.data.data.name }));
      setIsEditNameModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update team name.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async () => {
    try {
      setSubmitting(true);
      const targetState = !team.isActive;
      const res = await api.put(`/teams/${id}`, { isActive: targetState });
      toast.success(`Team ${targetState ? 'activated' : 'deactivated'} successfully!`);
      setTeam((prev) => ({ ...prev, isActive: res.data.data.isActive }));
      setIsStatusConfirmOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update team status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Assign Team Head
  const handleAssignHead = async (userId) => {
    if (!userId) return;
    try {
      setSubmitting(true);
      const res = await api.patch(`/teams/${id}/head`, { userId });
      toast.success('Team Head assigned successfully!');
      setTeam(res.data.data);
      setSelectedHeadId(userId);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign team head.');
      setSelectedHeadId(team.head?._id || '');
    } finally {
      setSubmitting(false);
    }
  };

  // Assign Team Assistant
  const handleAssignAssistant = async (userId) => {
    if (!userId) return;
    try {
      setSubmitting(true);
      const res = await api.patch(`/teams/${id}/assistant`, { userId });
      toast.success('Team Assistant assigned successfully!');
      setTeam(res.data.data);
      setSelectedAssistantId(userId);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign team assistant.');
      setSelectedAssistantId(team.assistant?._id || '');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedMemberToAdd) {
      toast.error('Please select an active user to add.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/teams/${id}/members`, { userId: selectedMemberToAdd });
      toast.success('Member added to team!');
      setTeam(res.data.data);
      setSelectedMemberToAdd('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member to team.');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Member Confirm
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setSubmitting(true);
      const res = await api.delete(`/teams/${id}/members/${memberToRemove._id}`);
      toast.success('Member removed from team.');
      setTeam(res.data.data);
      setMemberToRemove(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={4} cols={5} />
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <PageHeader
        backTo="/admin/teams"
        title={team.name}
        subtitle={`Team roster: ${team.members?.length || 0} members`}
        badge={<Badge status={team.isActive} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={Edit2}
              onClick={() => {
                setEditedName(team.name);
                setIsEditNameModalOpen(true);
              }}
            >
              Rename
            </Button>

            <Button
              variant={team.isActive ? 'outlineDanger' : 'secondary'}
              onClick={() => setIsStatusConfirmOpen(true)}
            >
              {team.isActive ? 'Deactivate team' : 'Activate team'}
            </Button>
          </div>
        }
      />

      {/* Leadership Assignment Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Team Head Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                Team leadership
              </span>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">Team Head</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Shield className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            {team.head ? (
              <div className="flex items-center gap-3">
                <Avatar name={team.head.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{team.head.name}</p>
                  <p className="text-xs text-slate-500">@{team.head.username} • {team.head.phone}</p>
                  <div className="mt-1.5">
                    <Badge role="teamHead" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">
                No Team Head currently assigned to this team.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assign or change Team Head
            </label>
            <select
              value={selectedHeadId}
              disabled={submitting}
              onChange={(e) => handleAssignHead(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select an active user...</option>
              {eligibleLeaders.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} (@{u.username}) — {u.role === 'teamHead' ? 'Team Head' : u.role === 'teamAssistant' ? 'Team Assistant' : u.role}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Selecting a new head will automatically revert the previous head to member.
            </p>
          </div>
        </Card>

        {/* Team Assistant Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Team support
              </span>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">Team Assistant</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Award className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            {team.assistant ? (
              <div className="flex items-center gap-3">
                <Avatar name={team.assistant.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{team.assistant.name}</p>
                  <p className="text-xs text-slate-500">@{team.assistant.username} • {team.assistant.phone}</p>
                  <div className="mt-1.5">
                    <Badge role="teamAssistant" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">
                No Team Assistant currently assigned to this team.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assign or change Team Assistant
            </label>
            <select
              value={selectedAssistantId}
              disabled={submitting}
              onChange={(e) => handleAssignAssistant(e.target.value)}
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select an active user...</option>
              {eligibleLeaders.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} (@{u.username}) — {u.role === 'teamHead' ? 'Team Head' : u.role === 'teamAssistant' ? 'Team Assistant' : u.role}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Selecting a new assistant will automatically revert the previous assistant to member.
            </p>
          </div>
        </Card>
      </div>

      {/* Team Members Section */}
      <Card className="overflow-hidden p-0">
        {/* Section Header with Add Member Form */}
        <div className="border-b border-slate-200 p-5 sm:p-6 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Team members roster</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage members assigned to this team. Users can belong to only one team at a time.
              </p>
            </div>

            {/* Add Member Dropdown Form */}
            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                disabled={submitting || eligibleNewMembers.length === 0}
                className="h-11 min-h-[44px] rounded-lg border border-slate-200 px-3 text-sm bg-white focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition disabled:bg-slate-100 sm:w-64"
              >
                <option value="">
                  {eligibleNewMembers.length === 0
                    ? 'No unassigned users available'
                    : 'Select user to add...'}
                </option>
                {eligibleNewMembers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} (@{u.username})
                  </option>
                ))}
              </select>

              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !selectedMemberToAdd}
                icon={Plus}
              >
                Add member
              </Button>
            </form>
          </div>
        </div>

        {/* Member List */}
        {!team.members || team.members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members in this team"
            description="Use the dropdown above to add active users to this team roster."
          />
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Name</th>
                    <th scope="col" className="px-5 py-3.5">Phone</th>
                    <th scope="col" className="px-5 py-3.5">Role</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.members.map((member) => (
                    <tr key={member._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.name} size="xs" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{member.name}</span>
                              {team.head?._id === member._id && (
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                                  Head
                                </span>
                              )}
                              {team.assistant?._id === member._id && (
                                <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                  Assistant
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">@{member.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                        {member.phone}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge role={member.role} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <Badge status={member.isActive} />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Below 768px: clean cards, no horizontal scroll) */}
            <div className="md:hidden divide-y divide-slate-100">
              {team.members.map((member) => (
                <div key={member._id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-sm">{member.name}</h4>
                          {team.head?._id === member._id && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 border border-slate-200">
                              Head
                            </span>
                          )}
                          {team.assistant?._id === member._id && (
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              Assistant
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">@{member.username} • {member.phone}</p>
                      </div>
                    </div>
                    <Badge status={member.isActive} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Badge role={member.role} />
                    <Button
                      variant="outlineDanger"
                      size="sm"
                      onClick={() => setMemberToRemove(member)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Rename Team Modal */}
      <Modal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        title="Rename team"
        subtitle="Update the official team title"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateName} className="space-y-4">
          <Input
            label="Team name"
            required
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            autoFocus
          />

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditNameModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Save name
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toggle Team Status Confirm Dialog */}
      <ConfirmDialog
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={team.isActive ? 'Deactivate team?' : 'Activate team?'}
        message={`Are you sure you want to ${team.isActive ? 'deactivate' : 'activate'
          } "${team.name}"? ${team.isActive
            ? 'Inactive teams cannot have new members or entries assigned to them.'
            : 'The team will be available for game activities and entries.'
          }`}
        confirmText={team.isActive ? 'Deactivate' : 'Activate'}
        confirmVariant={team.isActive ? 'danger' : 'primary'}
        loading={submitting}
      />

      {/* Remove Member Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove member from team?"
        message={`Are you sure you want to remove ${memberToRemove?.name} from ${team.name}? Their team assignment will be cleared and any head/assistant duties unassigned.`}
        confirmText="Remove member"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default AdminTeamDetail;
