import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, KeyRound } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Badge from '../../components/Badge';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';

const AdminUsers = () => {
  const { user: currentUser } = useAuth();

  // List & Filter States
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [togglingUser, setTogglingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form States
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    phone: '',
    password: '',
    role: 'member',
    team: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    phone: '',
    role: 'member',
    team: '',
    isActive: true,
  });

  const [newPassword, setNewPassword] = useState('');

  // Debounce search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
  };

  // Fetch teams for dropdowns
  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load teams list:', err);
    }
  };

  // Fetch users with current filters & pagination
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter !== '') params.append('isActive', statusFilter);

      const res = await api.get(`/users?${params.toString()}`);
      if (res.data?.success) {
        setUsers(res.data.data.users || []);
        setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, debouncedSearch, roleFilter, statusFilter]);

  // Handle Add User
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!addForm.name.trim() || !addForm.username.trim() || !addForm.phone.trim() || !addForm.password) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const cleanUsername = addForm.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(cleanUsername)) {
      setFormError('Username must be 3-30 characters and only contain lowercase letters, numbers, dot, and underscore.');
      return;
    }

    if (!/^[0-9]{10}$/.test(addForm.phone.trim())) {
      setFormError('Phone number must be a valid 10-digit number.');
      return;
    }

    if (addForm.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: addForm.name.trim(),
        username: cleanUsername,
        phone: addForm.phone.trim(),
        password: addForm.password,
        role: addForm.role,
        team: addForm.team || undefined,
      };

      await api.post('/users', payload);
      toast.success('User created successfully!');
      setIsAddModalOpen(false);
      setAddForm({ name: '', username: '', phone: '', password: '', role: 'member', team: '' });
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create user.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (targetUser) => {
    setFormError('');
    setEditingUser(targetUser);
    setEditForm({
      name: targetUser.name || '',
      username: targetUser.username || '',
      phone: targetUser.phone || '',
      role: targetUser.role || 'member',
      team: targetUser.team?._id || targetUser.team || '',
      isActive: targetUser.isActive ?? true,
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!editForm.name.trim() || !editForm.username.trim() || !editForm.phone.trim()) {
      setFormError('Name, username, and phone number are required.');
      return;
    }

    const cleanUsername = editForm.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(cleanUsername)) {
      setFormError('Username must be 3-30 characters and only contain lowercase letters, numbers, dot, and underscore.');
      return;
    }

    if (!/^[0-9]{10}$/.test(editForm.phone.trim())) {
      setFormError('Phone number must be a valid 10-digit number.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: editForm.name.trim(),
        username: cleanUsername,
        phone: editForm.phone.trim(),
        role: editForm.role,
        team: editForm.team || null,
        isActive: editForm.isActive,
      };

      await api.put(`/users/${editingUser._id}`, payload);
      toast.success('User updated successfully!');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update user.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Password Reset Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!newPassword || newPassword.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      await api.patch(`/users/${resettingUser._id}/reset-password`, {
        password: newPassword,
      });
      toast.success('Password reset successfully!');
      setResettingUser(null);
      setNewPassword('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Active Confirm
  const handleToggleActiveConfirm = async () => {
    if (!togglingUser) return;
    try {
      setSubmitting(true);
      const targetState = !togglingUser.isActive;
      await api.put(`/users/${togglingUser._id}`, { isActive: targetState });
      toast.success(
        `User ${targetState ? 'activated' : 'deactivated'} successfully.`
      );
      setTogglingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <PageHeader
        title="User Management"
        subtitle="Create and maintain member accounts, roles, and chapter teams."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setFormError('');
              setIsAddModalOpen(true);
            }}
          >
            Add User
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, username or phone..."
              className="w-full min-h-[40px] rounded-lg border border-slate-300 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="flex gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs sm:text-sm text-slate-700 bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="teamHead">Team Head</option>
              <option value="teamAssistant">Team Assistant</option>
              <option value="member">Member</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs sm:text-sm text-slate-700 bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Content Container */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg
              className="mx-auto h-12 w-12 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="mt-3 text-base font-semibold text-slate-800">No users found</p>
            <p className="mt-1 text-sm text-slate-500">
              {debouncedSearch || roleFilter || statusFilter
                ? 'Try adjusting your search query or filter options.'
                : 'Click "Add User" above to create your first user.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">User</th>
                    <th scope="col" className="px-6 py-3.5">Phone</th>
                    <th scope="col" className="px-6 py-3.5">Role</th>
                    <th scope="col" className="px-6 py-3.5">Team</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((item) => {
                    const isSelf = currentUser?._id === item._id;
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                            <span>{item.name}</span>
                            <span className="text-xs font-normal text-slate-500">@{item.username}</span>
                            {isSelf && (
                              <span className="ml-1 inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{item.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge role={item.role} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          {item.team?.name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge status={item.isActive} />
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setFormError('');
                              setNewPassword('');
                              setResettingUser(item);
                            }}
                            className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                          >
                            Reset Pwd
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setTogglingUser(item)}
                              className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                item.isActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {item.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.map((item) => {
                const isSelf = currentUser?._id === item._id;
                return (
                  <div key={item._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900">{item.name}</h3>
                          <span className="text-xs font-normal text-slate-500">@{item.username}</span>
                          {isSelf && (
                            <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.phone}</p>
                      </div>
                      <Badge status={item.isActive} />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Badge role={item.role} />
                      <span>•</span>
                      <span>Team: {item.team?.name || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setFormError('');
                          setNewPassword('');
                          setResettingUser(item);
                        }}
                        className="flex-1 min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition"
                      >
                        Reset Pwd
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => setTogglingUser(item)}
                          className={`flex-1 min-h-[38px] items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition ${
                            item.isActive
                              ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                              : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              onPageChange={(newPage) => setPagination((prev) => ({ ...prev, page: newPage }))}
            />
          </>
        )}
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New User"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder="e.g. Rajesh Kumar"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. rajeshkumar"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              3-30 chars, lowercase letters, numbers, dot, underscore
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number (10 digits) *
            </label>
            <input
              type="tel"
              inputMode="tel"
              required
              value={addForm.phone}
              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password (min. 6 characters) *
            </label>
            <input
              type="password"
              required
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder="Initial account password"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role *
              </label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="member">Member</option>
                <option value="teamHead">Team Head</option>
                <option value="teamAssistant">Team Assistant</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Team (Optional)
              </label>
              <select
                value={addForm.team}
                onChange={(e) => setAddForm({ ...addForm, team: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">No Team</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {!t.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3">
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
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal (No password field) */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User: ${editingUser?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              required
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. rajeshkumar"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              3-30 chars, lowercase letters, numbers, dot, underscore
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number (10 digits) *
            </label>
            <input
              type="tel"
              inputMode="tel"
              required
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role *
              </label>
              <select
                value={editForm.role}
                disabled={currentUser?._id === editingUser?._id}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
              >
                <option value="member">Member</option>
                <option value="teamHead">Team Head</option>
                <option value="teamAssistant">Team Assistant</option>
                <option value="admin">Admin</option>
              </select>
              {currentUser?._id === editingUser?._id && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Admins cannot change their own role
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Team
              </label>
              <select
                value={editForm.team}
                onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">No Team</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {!t.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Status
            </label>
            <select
              value={editForm.isActive ? 'true' : 'false'}
              disabled={currentUser?._id === editingUser?._id}
              onChange={(e) =>
                setEditForm({ ...editForm, isActive: e.target.value === 'true' })
              }
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            {currentUser?._id === editingUser?._id && (
              <p className="text-[11px] text-slate-400 mt-1">
                Admins cannot deactivate their own account
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resettingUser}
        onClose={() => setResettingUser(null)}
        title={`Reset Password for ${resettingUser?.name || ''}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (min. 6 characters) *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResettingUser(null)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Updating...' : 'Set Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate/Activate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!togglingUser}
        onClose={() => setTogglingUser(null)}
        onConfirm={handleToggleActiveConfirm}
        title={togglingUser?.isActive ? 'Deactivate User Account' : 'Activate User Account'}
        message={`Are you sure you want to ${
          togglingUser?.isActive ? 'deactivate' : 'activate'
        } ${togglingUser?.name}? ${
          togglingUser?.isActive
            ? 'The user will be blocked from logging into the platform.'
            : 'The user will regain login access.'
        }`}
        confirmText={togglingUser?.isActive ? 'Deactivate' : 'Activate'}
        isDanger={togglingUser?.isActive}
        isLoading={submitting}
      />
    </div>
  );
};

export default AdminUsers;

