import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Badge from '../../components/Badge';

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
      fetchData(); // Refresh active users list so role updates
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
      <div className="flex flex-col items-center justify-center p-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        <p className="mt-3 text-sm font-medium">Loading team details...</p>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="space-y-6">
      {/* Back button and breadcrumb */}
      <div>
        <Link
          to="/admin/teams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Teams List</span>
        </Link>
      </div>

      {/* Team Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {team.name}
              </h1>
              <Badge status={team.isActive} />
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Team Roster: <strong className="text-slate-800">{team.members?.length || 0} members</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditedName(team.name);
                setIsEditNameModalOpen(true);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Rename</span>
            </button>

            <button
              onClick={() => setIsStatusConfirmOpen(true)}
              className={`inline-flex min-h-[40px] items-center rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition ${
                team.isActive
                  ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                  : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {team.isActive ? 'Deactivate Team' : 'Activate Team'}
            </button>
          </div>
        </div>
      </div>

      {/* Leadership Assignment Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Team Head Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Team Leadership
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">Team Head</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            {team.head ? (
              <div>
                <p className="text-base font-bold text-slate-900">{team.head.name}</p>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">@{team.head.username}</p>
                <p className="text-xs text-slate-500">{team.head.phone}</p>
                <div className="mt-2">
                  <Badge role="teamHead" />
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
              Assign or Change Team Head
            </label>
            <select
              value={selectedHeadId}
              disabled={submitting}
              onChange={(e) => handleAssignHead(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
            >
              <option value="">Select an active user...</option>
              {eligibleLeaders.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} (@{u.username}) — {u.role}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Selecting a new head will automatically change the previous head back to member.
            </p>
          </div>
        </div>

        {/* Team Assistant Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Team Support
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">Team Assistant</h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            {team.assistant ? (
              <div>
                <p className="text-base font-bold text-slate-900">{team.assistant.name}</p>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">@{team.assistant.username}</p>
                <p className="text-xs text-slate-500">{team.assistant.phone}</p>
                <div className="mt-2">
                  <Badge role="teamAssistant" />
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
              Assign or Change Team Assistant
            </label>
            <select
              value={selectedAssistantId}
              disabled={submitting}
              onChange={(e) => handleAssignAssistant(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
            >
              <option value="">Select an active user...</option>
              {eligibleLeaders.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} (@{u.username}) — {u.role}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Selecting a new assistant will automatically revert the previous assistant back to member.
            </p>
          </div>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Section Header with Add Member Form */}
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Team Members Roster</h2>
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
                className="min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50 sm:w-64"
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

              <button
                type="submit"
                disabled={submitting || !selectedMemberToAdd}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition"
              >
                Add Member
              </button>
            </form>
          </div>
        </div>

        {/* Member List */}
        {!team.members || team.members.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <p className="mt-3 text-base font-semibold text-slate-800">No members in this team</p>
            <p className="mt-1 text-sm text-slate-500">
              Use the dropdown above to add active users to this team roster.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Name</th>
                    <th scope="col" className="px-6 py-3.5">Phone</th>
                    <th scope="col" className="px-6 py-3.5">Role</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.members.map((member) => (
                    <tr key={member._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{member.name}</span>
                          <span className="text-xs font-normal text-slate-400">@{member.username}</span>
                        </div>
                        {team.head?._id === member._id && (
                          <span className="mt-1 inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            Head
                          </span>
                        )}
                        {team.assistant?._id === member._id && (
                          <span className="mt-1 inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            Assistant
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{member.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge role={member.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge status={member.isActive} />
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {team.members.map((member) => (
                <div key={member._id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900">{member.name}</h4>
                        <span className="text-xs text-slate-400">@{member.username}</span>
                        {team.head?._id === member._id && (
                          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                            Head
                          </span>
                        )}
                        {team.assistant?._id === member._id && (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            Assistant
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{member.phone}</p>
                    </div>
                    <Badge status={member.isActive} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Badge role={member.role} />
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-50 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Rename Team Modal */}
      <Modal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        title="Rename Team"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateName} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Team Name *
            </label>
            <input
              type="text"
              required
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditNameModalOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Updating...' : 'Save Name'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toggle Team Status Confirm Dialog */}
      <ConfirmDialog
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={team.isActive ? 'Deactivate Team' : 'Activate Team'}
        message={`Are you sure you want to ${
          team.isActive ? 'deactivate' : 'activate'
        } "${team.name}"? ${
          team.isActive
            ? 'Inactive teams cannot have new members or entries assigned to them.'
            : 'The team will be available for game activities and entries.'
        }`}
        confirmText={team.isActive ? 'Deactivate' : 'Activate'}
        isDanger={team.isActive}
        isLoading={submitting}
      />

      {/* Remove Member Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member from Team"
        message={`Are you sure you want to remove ${memberToRemove?.name} from ${team.name}? Their team assignment will be cleared and any head/assistant duties unassigned.`}
        confirmText="Remove Member"
        isDanger={true}
        isLoading={submitting}
      />
    </div>
  );
};

export default AdminTeamDetail;

