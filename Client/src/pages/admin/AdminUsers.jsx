import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, KeyRound, Users, Edit3, Power } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Badge from '../../components/Badge';
import Pagination from '../../components/Pagination';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';
import PasswordInputWithStrength from '../../components/PasswordInputWithStrength';
import { validatePasswordClient } from '../../utils/passwordPolicy';

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
    email: '',
    phone: '',
    password: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
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

    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.phone.trim() || !addForm.password) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const cleanEmail = addForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!/^[0-9]{10}$/.test(addForm.phone.trim())) {
      setFormError('Phone number must be a valid 10-digit number.');
      return;
    }

    const pwdValidation = validatePasswordClient(addForm.password, {
      email: cleanEmail,
      name: addForm.name,
      phone: addForm.phone,
    });
    if (!pwdValidation.isValid) {
      setFormError(pwdValidation.message);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: addForm.name.trim(),
        email: cleanEmail,
        phone: addForm.phone.trim(),
        password: addForm.password,
      };

      await api.post('/users', payload);
      toast.success('User created successfully!');
      setIsAddModalOpen(false);
      setAddForm({ name: '', email: '', phone: '', password: '' });
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
      email: targetUser.email || '',
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

    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.phone.trim()) {
      setFormError('Name, email address, and phone number are required.');
      return;
    }

    const cleanEmail = editForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Please enter a valid email address.');
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
        email: cleanEmail,
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

    const pwdValidation = validatePasswordClient(newPassword, {
      email: resettingUser?.email,
      username: resettingUser?.username,
      name: resettingUser?.name,
      phone: resettingUser?.phone,
    });
    if (!pwdValidation.isValid) {
      setFormError(pwdValidation.message);
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
        title="Chapter users"
        subtitle="Create and maintain chapter members, team heads, and team assistants."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setFormError('');
              setAddForm({ name: '', email: '', phone: '', password: '' });
              setIsAddModalOpen(true);
            }}
          >
            Add user
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, email or phone..."
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full sm:w-auto h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All chapter roles</option>
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
              className="w-full sm:w-auto h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Content Container */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description={
              debouncedSearch || roleFilter || statusFilter
                ? 'Try adjusting your search query or filter options.'
                : 'Click "Add user" above to create your first user.'
            }
          />
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">User</th>
                    <th scope="col" className="px-5 py-3.5">Phone</th>
                    <th scope="col" className="px-5 py-3.5">Role</th>
                    <th scope="col" className="px-5 py-3.5">Team</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter((item) => item.role !== 'admin').map((item) => {
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={item.name} size="xs" />
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                                <span>{item.name}</span>
                              </div>
                              <span className="text-xs text-slate-400">
                                {item.email || (item.username ? `@${item.username}` : 'No email set')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500 tabular-nums">
                          {item.phone}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge role={item.role} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                          {item.team?.name || '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge status={item.isActive} />
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormError('');
                              setNewPassword('');
                              setResettingUser(item);
                            }}
                          >
                            Reset password
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTogglingUser(item)}
                            className={
                              item.isActive
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }
                          >
                            {item.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Below 768px: clean, structured cards) */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.filter((item) => item.role !== 'admin').map((item) => {
                return (
                  <div key={item._id} className="p-4 space-y-3">
                    {/* User Header: Avatar, Name, Email, Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar name={item.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5" title={item.email || ''}>
                            {item.email || (item.username ? `@${item.username}` : 'No email set')}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <Badge status={item.isActive} />
                      </div>
                    </div>

                    {/* Metadata Card: Role, Team, Phone */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 text-xs">
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">Role & Team</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge role={item.role} size="xs" />
                          <span className="font-medium text-slate-700 truncate text-[11px]">
                            {item.team?.name ? item.team.name : 'No team'}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 text-right">
                        <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">Phone</span>
                        <span className="font-medium text-slate-800 mt-0.5 block truncate tabular-nums">
                          {item.phone || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Clean responsive buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(item)}
                        className="flex-1 min-w-[70px] min-h-[38px]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFormError('');
                          setNewPassword('');
                          setResettingUser(item);
                        }}
                        className="flex-1 min-w-[90px] min-h-[38px] whitespace-nowrap"
                      >
                        Reset pwd
                      </Button>
                      <Button
                        variant={item.isActive ? 'outlineDanger' : 'secondary'}
                        size="sm"
                        onClick={() => setTogglingUser(item)}
                        className="flex-1 min-w-[95px] min-h-[38px] whitespace-nowrap"
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
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
        title="Add new user"
        subtitle="Create a new chapter member account"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full name"
              required
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder="e.g. Rajesh Kumar"
            />

            <Input
              label="Email address"
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value.toLowerCase().trim() })}
              placeholder="e.g. rajesh@example.com"
              helperText="Valid email address for account login"
            />
          </div>

          <div>
            <Input
              label="Phone number (10 digits)"
              type="tel"
              inputMode="numeric"
              required
              value={addForm.phone}
              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              placeholder="e.g. 9876543210"
            />
          </div>

          <PasswordInputWithStrength
            value={addForm.password}
            onChange={(val) => setAddForm({ ...addForm, password: val })}
            userContext={{
              email: addForm.email,
              name: addForm.name,
              phone: addForm.phone,
            }}
            label="Initial password"
            placeholder="Enter strong password (min. 12 chars)"
            required
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
              Create user
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit user: ${editingUser?.name || ''}`}
        subtitle="Update profile details and assignments"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full name"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />

            <Input
              label="Email address"
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value.toLowerCase().trim() })}
              helperText="Unique login email"
            />
          </div>

          <Input
            label="Phone number (10 digits)"
            type="tel"
            inputMode="numeric"
            required
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              >
                <option value="member">Member</option>
                <option value="teamHead">Team Head</option>
                <option value="teamAssistant">Team Assistant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Team
              </label>
              <select
                value={editForm.team}
                onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {!t.isActive ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Account status
            </label>
            <select
              value={editForm.isActive ? 'true' : 'false'}
              disabled={currentUser?._id === editingUser?._id}
              onChange={(e) =>
                setEditForm({ ...editForm, isActive: e.target.value === 'true' })
              }
              className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-sm text-slate-900 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            {currentUser?._id === editingUser?._id && (
              <p className="text-xs text-slate-400 mt-1">
                Admins cannot deactivate their own account
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resettingUser}
        onClose={() => setResettingUser(null)}
        title={`Reset password: ${resettingUser?.name || ''}`}
        subtitle="Set a new account password"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <PasswordInputWithStrength
            value={newPassword}
            onChange={setNewPassword}
            userContext={{
              email: resettingUser?.email,
              username: resettingUser?.username,
              name: resettingUser?.name,
              phone: resettingUser?.phone,
            }}
            label="New password"
            placeholder="Enter strong password (min. 12 chars)"
            required
            autoFocus
          />

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResettingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              Set password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate/Activate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!togglingUser}
        onClose={() => setTogglingUser(null)}
        onConfirm={handleToggleActiveConfirm}
        title={togglingUser?.isActive ? 'Deactivate user account?' : 'Activate user account?'}
        message={`Are you sure you want to ${
          togglingUser?.isActive ? 'deactivate' : 'activate'
        } ${togglingUser?.name}? ${
          togglingUser?.isActive
            ? 'The user will be blocked from logging into the platform.'
            : 'The user will regain login access.'
        }`}
        confirmText={togglingUser?.isActive ? 'Deactivate' : 'Activate'}
        confirmVariant={togglingUser?.isActive ? 'danger' : 'primary'}
        loading={submitting}
      />
    </div>
  );
};

export default AdminUsers;
