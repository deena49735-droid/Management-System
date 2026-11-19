import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Check,
  Copy,
  AlertCircle,
  RefreshCw,
  Phone,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Badge from '../../components/Badge';
import Avatar from '../../components/Avatar';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { Skeleton, SkeletonTable } from '../../components/Skeleton';
import PasswordInputWithStrength from '../../components/PasswordInputWithStrength';
import { validatePasswordClient } from '../../utils/passwordPolicy';
import SearchBar from '../../components/SearchBar';

const MyTeam = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('create'); // 'create' | 'existing'

  // Tab A: Create new member form state
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    password: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  // Tab B: Add existing member state
  const [searchQuery, setSearchQuery] = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addingId, setAddingId] = useState(null);

  // Member Removal State & Permissions
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const canRemoveMembers = user?.role === 'teamHead' || user?.role === 'admin';

  const fetchTeam = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/teams/my');
      setTeam(res.data?.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load your team roster.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  // Fetch available unassigned members for Tab B
  const fetchAvailableMembers = async (search = '') => {
    try {
      setLoadingAvailable(true);
      const res = await api.get('/teams/my/available-members', {
        params: { search: search || undefined },
      });
      setAvailableMembers(res.data?.data || []);
    } catch {
      toast.error('Failed to load available members.');
    } finally {
      setLoadingAvailable(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && modalTab === 'existing') {
      fetchAvailableMembers(searchQuery);
    }
  }, [isModalOpen, modalTab, searchQuery]);

  const handleOpenModal = () => {
    setModalTab('create');
    setFormData({ name: '', username: '', phone: '', password: '' });
    setCreateError(null);
    setCreatedCredentials(null);
    setCopied(false);
    setSearchQuery('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCreatedCredentials(null);
    setCreateError(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);

    // Basic frontend verification
    if (!formData.name.trim()) {
      setCreateError('Full name is required.');
      return;
    }
    if (!formData.username.trim()) {
      setCreateError('Username is required.');
      return;
    }
    if (!/^[a-z0-9._]{3,30}$/.test(formData.username.trim().toLowerCase())) {
      setCreateError('Username must be 3-30 lowercase characters with numbers, dot or underscore.');
      return;
    }
    if (!/^[0-9]{10}$/.test(formData.phone.trim())) {
      setCreateError('Phone must be a valid 10-digit number.');
      return;
    }
    const pwdValidation = validatePasswordClient(formData.password, {
      username: formData.username,
      name: formData.name,
      phone: formData.phone,
    });
    if (!pwdValidation.isValid) {
      setCreateError(pwdValidation.message);
      return;
    }

    try {
      setCreating(true);
      await api.post('/teams/my/members', {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
      });

      // Save credentials for the confirmation card
      setCreatedCredentials({
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
      });
      toast.success('Member created successfully!');

      // Reset form fields
      setFormData({ name: '', username: '', phone: '', password: '' });

      // Refresh team list
      fetchTeam();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create member.';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const textToCopy = `Kadambas Game Login Details:\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Login details copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleAddExisting = async (userId) => {
    try {
      setAddingId(userId);
      await api.post('/teams/my/members/add', { userId });
      toast.success('Member added to your team!');
      fetchTeam();
      fetchAvailableMembers(searchQuery);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member to team.');
    } finally {
      setAddingId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    try {
      setRemoving(true);
      const targetId = memberToRemove._id;
      await api.delete(`/teams/my/members/${targetId}`);
      toast.success(`${memberToRemove.name} removed from team.`);

      // Update roster state immediately without refreshing
      setTeam((prev) => {
        if (!prev) return prev;
        const filteredMembers = (prev.members || []).filter(
          (m) => (m._id?.toString() || m._id) !== targetId.toString()
        );
        return {
          ...prev,
          members: filteredMembers,
          memberCount: filteredMembers.length,
        };
      });
      setMemberToRemove(null);

      // Keep backend synchronicity
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member from team.');
    } finally {
      setRemoving(false);
    }
  };

  // Build unified member roster: Head once, Assistant once, Members once
  const headItem = team?.head ? [{ ...team.head, teamRoleLabel: 'Head' }] : [];
  const headId = team?.head?._id ? team.head._id.toString() : team?.head?.toString() || '';

  const assistantItem =
    team?.assistant && (!headId || (team.assistant._id?.toString() || team.assistant.toString()) !== headId)
      ? [{ ...team.assistant, teamRoleLabel: 'Assistant' }]
      : [];
  const assistantId = team?.assistant?._id ? team.assistant._id.toString() : team?.assistant?.toString() || '';

  const memberItems = (team?.members || [])
    .filter((m) => {
      if (!m || !m._id) return false;
      const mId = m._id.toString();
      return mId !== headId && mId !== assistantId;
    })
    .map((m) => ({ ...m, teamRoleLabel: 'Member' }));

  // Build unified roster deduplicating strictly by unique string _id
  const rosterMap = new Map();
  [...headItem, ...assistantItem, ...memberItems].forEach((person) => {
    const idStr = person._id?.toString() || person._id;
    if (idStr && !rosterMap.has(idStr)) {
      rosterMap.set(idStr, person);
    }
  });
  const allMembers = Array.from(rosterMap.values());

  const [rosterSearch, setRosterSearch] = useState('');

  const filteredMembers = useMemo(() => {
    if (!rosterSearch.trim()) return allMembers;
    const q = rosterSearch.trim().toLowerCase();
    return allMembers.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const username = (m.username || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      const role = (m.teamRoleLabel || m.role || '').toLowerCase();
      return name.includes(q) || username.includes(q) || phone.includes(q) || role.includes(q);
    });
  }, [allMembers, rosterSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={team?.name ? `${team.name} • Team Roster` : 'My Team'}
        subtitle="View all members of your chapter team and invite or add new members."
        showBack={true}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={UserPlus}
            onClick={handleOpenModal}
          >
            Add member
          </Button>
        }
      />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </div>
          <Button variant="danger" size="sm" onClick={fetchTeam}>
            Retry
          </Button>
        </div>
      )}

      {/* Roster Search Bar */}
      {!loading && allMembers.length > 0 && (
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <SearchBar
              value={rosterSearch}
              onChange={setRosterSearch}
              placeholder="Search team roster by name, username, phone, or role..."
            />
            {rosterSearch && (
              <div className="flex items-center gap-2 self-center sm:self-auto shrink-0 text-xs text-slate-500">
                <span>
                  Matching: <strong className="text-slate-800">{filteredMembers.length}</strong> of {allMembers.length}
                </span>
                <button
                  type="button"
                  onClick={() => setRosterSearch('')}
                  className="font-semibold text-brand-600 hover:text-brand-800 ml-1"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Main Roster Card */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : allMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members in team"
            description="Add existing or newly registered members to build your squad."
            actionLabel="Add member"
            onAction={handleOpenModal}
          />
        ) : filteredMembers.length === 0 && rosterSearch ? (
          <EmptyState
            icon={Search}
            title="No team members match your search"
            description={`No members found matching "${rosterSearch}".`}
            actionLabel="Clear search"
            onAction={() => setRosterSearch('')}
          />
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Member</th>
                    <th className="px-5 py-3.5">Phone</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Status</th>
                    {canRemoveMembers && (
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((m) => {
                    const isRemovable =
                      canRemoveMembers &&
                      m.teamRoleLabel === 'Member' &&
                      m.role === 'member' &&
                      (m._id?.toString() || m._id) !== (user?._id?.toString() || user?._id);

                    return (
                      <tr key={m._id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={m.name} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900">{m.name}</span>
                                {m.teamRoleLabel === 'Head' && (
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                    Head
                                  </span>
                                )}
                                {m.teamRoleLabel === 'Assistant' && (
                                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                    Assistant
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">@{m.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                          {m.phone || '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge role={m.role} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge status={m.isActive !== false} />
                        </td>
                        {canRemoveMembers && (
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            {isRemovable && (
                              <Button
                                type="button"
                                variant="outlineDanger"
                                size="sm"
                                icon={UserMinus}
                                onClick={() => setMemberToRemove(m)}
                              >
                                Remove
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredMembers.map((m) => {
                const isRemovable =
                  canRemoveMembers &&
                  m.teamRoleLabel === 'Member' &&
                  m.role === 'member' &&
                  (m._id?.toString() || m._id) !== (user?._id?.toString() || user?._id);

                return (
                  <div key={m._id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-semibold text-slate-900 text-sm">{m.name}</h4>
                            {m.teamRoleLabel === 'Head' && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                                Head
                              </span>
                            )}
                            {m.teamRoleLabel === 'Assistant' && (
                              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                Assistant
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            @{m.username} • {m.phone || '—'}
                          </p>
                        </div>
                      </div>
                      <Badge status={m.isActive !== false} />
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                      <span className="text-slate-400">Role assignment</span>
                      <Badge role={m.role} />
                    </div>
                    {isRemovable && (
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outlineDanger"
                          size="sm"
                          icon={UserMinus}
                          onClick={() => setMemberToRemove(m)}
                        >
                          Remove from team
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Add Member Modal (Bottom sheet on mobile, modal on desktop) */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add team member"
        subtitle={`Add a chapter member to ${team?.name || 'your team'}.`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Tab Selector */}
          {!createdCredentials && (
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setModalTab('create');
                  setCreateError(null);
                }}
                className={`flex-1 min-h-[44px] md:min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  modalTab === 'create'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create new member
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('existing');
                  setCreateError(null);
                }}
                className={`flex-1 min-h-[44px] md:min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  modalTab === 'existing'
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Add existing member
              </button>
            </div>
          )}

          {/* TAB A: Create New Member */}
          {modalTab === 'create' && (
            <div>
              {createdCredentials ? (
                /* Success Confirmation Card */
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      <h4 className="font-semibold text-sm">Member Created Successfully</h4>
                    </div>

                    <div className="rounded-lg bg-white p-3.5 border border-emerald-200 space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Name</span>
                        <span className="font-semibold text-slate-800">{createdCredentials.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Username</span>
                        <span className="font-mono font-bold text-slate-900">@{createdCredentials.username}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Password</span>
                        <span className="font-mono font-bold text-slate-900">{createdCredentials.password}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={copied ? Check : Copy}
                        onClick={handleCopyCredentials}
                        className={copied ? 'text-emerald-700 border-emerald-300' : ''}
                      >
                        {copied ? 'Copied to clipboard' : 'Copy credentials'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setCreatedCredentials(null);
                          setFormData({ name: '', username: '', phone: '', password: '' });
                        }}
                      >
                        Create another
                      </Button>
                    </div>

                    <p className="text-[11px] text-emerald-700 italic">
                      Share these login details privately with the member.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button variant="secondary" onClick={handleCloseModal}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                /* Member Creation Form */
                <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                  {createError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base md:text-sm text-slate-800 placeholder-slate-400 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="e.g. john.doe"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base md:text-sm text-slate-800 placeholder-slate-400 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      3-30 characters; lowercase letters, numbers, dot, and underscore only.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base md:text-sm text-slate-800 placeholder-slate-400 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <PasswordInputWithStrength
                    value={formData.password}
                    onChange={(val) => setFormData({ ...formData, password: val })}
                    userContext={{
                      username: formData.username,
                      name: formData.name,
                      phone: formData.phone,
                    }}
                    label="Initial password"
                    placeholder="Enter or suggest strong password"
                    required
                  />

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCloseModal}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={creating}
                      disabled={creating}
                    >
                      Create member
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB B: Add Existing Unassigned Member */}
          {modalTab === 'existing' && (
            <div className="space-y-3.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search available members by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-base md:text-sm text-slate-800 placeholder-slate-400 shadow-2xs focus:border-brand-500 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {loadingAvailable ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Loading available members...
                  </div>
                ) : availableMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No unassigned members found.
                  </div>
                ) : (
                  availableMembers.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <Avatar name={m.name} size="xs" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {m.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">@{m.username}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={addingId === m._id}
                        isLoading={addingId === m._id}
                        onClick={() => handleAddExisting(m._id)}
                      >
                        Add to team
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button variant="secondary" onClick={handleCloseModal}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemove}
        title="Remove from Team"
        message={`Are you sure you want to remove ${memberToRemove?.name} from ${team?.name || 'your team'}? Their team assignment will be cleared, while their account, point history, and attendance records will be safely preserved.`}
        confirmText="Remove from Team"
        cancelText="Cancel"
        isDanger={true}
        isLoading={removing}
      />
    </div>
  );
};

export default MyTeam;

