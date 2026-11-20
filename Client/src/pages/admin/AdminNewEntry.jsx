import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Calendar,
  PlusCircle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import api from '../../api/axios';
import ProofUpload from '../../components/ProofUpload';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { SkeletonCard } from '../../components/Skeleton';
import ActivityCriteriaSelect from '../../components/ActivityCriteriaSelect';

const CATEGORY_ORDER = ['meeting_day', 'non_meeting_day', 'penalty'];

const CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities',
  non_meeting_day: 'Non-Meeting Day Activities',
  penalty: 'Negative Points Criteria',
};

const allowsMultipleQuantity = (basisLabel = '') => {
  if (!basisLabel) return false;
  return /Per Visitor|Per Testimonial|Per Specific Ask|Per Week/i.test(basisLabel);
};

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const AdminNewEntry = () => {
  const navigate = useNavigate();
  const [criteriaList, setCriteriaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Eligible members state
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [membersReloadKey, setMembersReloadKey] = useState(0);

  // Member selector UI state
  const [memberId, setMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const memberDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Other form fields
  const [criteriaId, setCriteriaId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [proofPublicId, setProofPublicId] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  // Load criteria structure on mount
  useEffect(() => {
    let isMounted = true;

    const fetchCriteria = async () => {
      try {
        setLoading(true);
        const criteriaRes = await api.get('/criteria/structure');

        if (!isMounted) return;

        // Flatten member-level categories in PDF order
        const memberCats = (criteriaRes.data.data || []).filter(
          (cat) => cat.key === 'meeting_day' || cat.key === 'non_meeting_day' || cat.key === 'penalty'
        );

        const flattened = [];
        memberCats.forEach((cat) => {
          (cat.items || []).forEach((item) => {
            if (item.isActive) {
              flattened.push({
                ...item,
                categoryKey: cat.key,
                categoryLabel: cat.label,
              });
            }
          });
        });

        setCriteriaList(flattened);
      } catch (err) {
        if (!isMounted) return;
        toast.error(err.response?.data?.message || 'Failed to initialize entry form criteria.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCriteria();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch all eligible active chapter users with assigned team across all pages
  useEffect(() => {
    let isMounted = true;

    const fetchAllMembers = async () => {
      setLoadingMembers(true);
      setMembersError('');
      // Reset member selection on fresh load/retry so stale state is never displayed
      setMemberId('');

      try {
        // Page 1
        const firstRes = await api.get('/users', {
          params: { isActive: 'true', limit: 100, page: 1 },
        });

        if (!isMounted) return;

        const firstData = firstRes.data?.data;
        const firstUsers = firstData?.users || [];
        const totalPages = firstData?.pagination?.totalPages || 1;

        let allUsers = [...firstUsers];

        // Fetch remaining pages if any
        if (totalPages > 1) {
          const pagePromises = [];
          for (let p = 2; p <= totalPages; p++) {
            pagePromises.push(
              api.get('/users', {
                params: { isActive: 'true', limit: 100, page: p },
              })
            );
          }
          const addResponses = await Promise.all(pagePromises);
          if (!isMounted) return;
          addResponses.forEach((res) => {
            const pageUsers = res.data?.data?.users || [];
            allUsers.push(...pageUsers);
          });
        }

        // Eligibility filtering:
        // 1. Must be active (isActive !== false)
        // 2. Exclude admins (must have valid chapter role: member, teamHead, teamAssistant)
        // 3. Must have an assigned team with a valid team name
        const eligible = allUsers.filter((u) => {
          if (!u || u.isActive === false) return false;
          if (u.role === 'admin') return false;
          if (!['member', 'teamHead', 'teamAssistant'].includes(u.role)) return false;
          if (!u.team) return false;
          const hasTeamId = Boolean(u.team._id || (typeof u.team === 'string' && u.team.trim()));
          const hasTeamName = Boolean(u.team.name || (typeof u.team === 'string' && u.team.trim()));
          return hasTeamId && hasTeamName;
        });

        // Deduplicate by user ID
        const seen = new Set();
        const deduped = [];
        eligible.forEach((u) => {
          const uid = (u._id || u.id)?.toString();
          if (uid && !seen.has(uid)) {
            seen.add(uid);
            deduped.push(u);
          }
        });

        // Sort alphabetically by name, then username
        deduped.sort((a, b) => {
          const nameA = (a.name || '').trim();
          const nameB = (b.name || '').trim();
          const comp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
          if (comp !== 0) return comp;
          return (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' });
        });

        if (!isMounted) return;
        setEligibleMembers(deduped);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching eligible members:', err);
        const msg = err.response?.data?.message || err.message || 'Failed to load eligible members.';
        setMembersError(msg);
        setEligibleMembers([]);
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };

    fetchAllMembers();

    return () => {
      isMounted = false;
    };
  }, [membersReloadKey]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setIsMemberDropdownOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMemberDropdownOpen) {
        setIsMemberDropdownOpen(false);
      }
    };

    if (isMemberDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMemberDropdownOpen]);

  // Currently selected member object
  const selectedMember = useMemo(() => {
    if (!memberId) return null;
    return eligibleMembers.find((m) => (m._id || m.id)?.toString() === memberId.toString()) || null;
  }, [eligibleMembers, memberId]);

  // Derived team name from selected member
  const assignedTeamName = useMemo(() => {
    if (!selectedMember || !selectedMember.team) return '';
    return typeof selectedMember.team === 'object' && selectedMember.team.name
      ? selectedMember.team.name
      : typeof selectedMember.team === 'string'
      ? selectedMember.team
      : '';
  }, [selectedMember]);

  // Filtered members for dropdown search
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return eligibleMembers;
    const q = memberSearch.trim().toLowerCase();
    return eligibleMembers.filter((m) => {
      const nameMatch = (m.name || '').toLowerCase().includes(q);
      const usernameMatch = (m.username || '').toLowerCase().includes(q);
      const teamName = typeof m.team === 'object' && m.team?.name ? m.team.name : (typeof m.team === 'string' ? m.team : '');
      const teamMatch = teamName.toLowerCase().includes(q);
      return nameMatch || usernameMatch || teamMatch;
    });
  }, [eligibleMembers, memberSearch]);

  const handleSelectMember = (m) => {
    const id = (m._id || m.id)?.toString();
    setMemberId(id || '');
    setIsMemberDropdownOpen(false);
    setMemberSearch('');
    setServerError('');
  };

  const handleClearMember = (e) => {
    if (e) e.stopPropagation();
    setMemberId('');
    setMemberSearch('');
    setIsMemberDropdownOpen(false);
  };

  const selectedCriteria = criteriaList.find((c) => (c.id || c._id) === criteriaId);
  const showQuantity = selectedCriteria && allowsMultipleQuantity(selectedCriteria.basisLabel);
  const previewPoints = selectedCriteria
    ? selectedCriteria.points * (showQuantity ? Number(quantity) || 1 : 1)
    : 0;
  const isNegative = previewPoints < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!memberId) {
      toast.error('Please select a member.');
      return;
    }

    if (!criteriaId) {
      toast.error('Please select an activity criteria.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/entries', {
        member: memberId,
        criteria: criteriaId,
        quantity: showQuantity ? Number(quantity) || 1 : 1,
        date: date || new Date().toISOString(),
        note: note ? note.trim() : undefined,
        proofImage: (typeof proofImage === 'string' && proofImage.trim()) ? proofImage.trim() : undefined,
        proofPublicId: (typeof proofPublicId === 'string' && proofPublicId.trim()) ? proofPublicId.trim() : undefined,
      });

      toast.success('Activity created and auto-approved!');
      window.dispatchEvent(new CustomEvent('kadambas:approvals-changed'));
      navigate('/admin/entries');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit point entry.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <SkeletonCard rows={5} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <PageHeader
        backTo="/admin/entries"
        title="Submit member point entry"
        subtitle="Submit activity or penalty points for any chapter member. Entries are automatically approved."
      />

      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">Submission blocked:</p>
            <p className="mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      {/* Entry Form */}
      <Card className="p-5 sm:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Member & Team Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field 1: Member Selector */}
            <div ref={memberDropdownRef} className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Member <span className="text-rose-500">*</span>
              </label>

              {selectedMember ? (
                /* Selected Member Card */
                <div className="w-full h-11 min-h-[44px] rounded-lg border border-brand-200 bg-brand-50/40 px-3 flex items-center justify-between transition">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <UserCheck className="h-4 w-4 text-brand-600 shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {selectedMember.name}
                      </span>
                      {selectedMember.username && (
                        <span className="text-xs text-slate-500 font-mono shrink-0">
                          (@{selectedMember.username})
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          selectedMember.role === 'teamHead'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : selectedMember.role === 'teamAssistant'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {selectedMember.role === 'teamHead'
                          ? 'Team Head'
                          : selectedMember.role === 'teamAssistant'
                          ? 'Team Assistant'
                          : 'Member'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setIsMemberDropdownOpen(true);
                        setMemberSearch('');
                      }}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-100/60 transition disabled:opacity-50 cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleClearMember}
                      title="Clear selection"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition disabled:opacity-50 cursor-pointer"
                      aria-label="Clear member selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Unselected Trigger Button */
                <button
                  type="button"
                  disabled={loadingMembers || submitting}
                  onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                  className={`w-full h-11 min-h-[44px] rounded-lg border bg-white px-3 flex items-center justify-between text-left transition cursor-pointer ${
                    isMemberDropdownOpen
                      ? 'border-brand-500 ring-2 ring-brand-100'
                      : membersError
                      ? 'border-rose-300 hover:border-rose-400'
                      : 'border-slate-200 hover:border-slate-300'
                  } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
                  aria-expanded={isMemberDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <span className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium truncate">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {loadingMembers
                        ? 'Loading eligible members...'
                        : membersError
                        ? 'Error loading members'
                        : eligibleMembers.length === 0
                        ? 'No active members with assigned team'
                        : `-- Choose member (${eligibleMembers.length} available) --`}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isMemberDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}

              {/* Status & helper messages */}
              {loadingMembers && (
                <p className="mt-1 text-xs text-slate-500 animate-pulse">
                  Loading eligible chapter accounts...
                </p>
              )}
              {membersError && (
                <div className="mt-1 flex items-center justify-between text-xs text-rose-600">
                  <span>{membersError}</span>
                  <button
                    type="button"
                    onClick={() => setMembersReloadKey((k) => k + 1)}
                    className="ml-2 font-semibold underline hover:text-rose-700 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!loadingMembers && !membersError && eligibleMembers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No active members, heads, or assistants with an assigned team were found.
                </p>
              )}

              {/* Dropdown Floating Panel */}
              {isMemberDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in duration-150">
                  {/* Search Input Bar */}
                  <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search by name, @username, or team..."
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                      />
                      {memberSearch && (
                        <button
                          type="button"
                          onClick={() => setMemberSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          aria-label="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 px-0.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Showing {filteredMembers.length} of {eligibleMembers.length} members
                      </span>
                      {memberSearch && (
                        <button
                          type="button"
                          onClick={() => setMemberSearch('')}
                          className="text-brand-600 hover:underline font-medium cursor-pointer"
                        >
                          Reset search
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Member Options List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100" role="listbox">
                    {filteredMembers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        {eligibleMembers.length === 0 ? (
                          'No eligible members found.'
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-700">No matching members found</p>
                            <p className="mt-0.5 text-slate-500">
                              No results for &ldquo;{memberSearch}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      filteredMembers.map((m) => {
                        const isSelected = (m._id || m.id)?.toString() === memberId?.toString();
                        const roleLabel =
                          m.role === 'teamHead'
                            ? 'Team Head'
                            : m.role === 'teamAssistant'
                            ? 'Team Assistant'
                            : 'Member';
                        const teamName =
                          m.team?.name || (typeof m.team === 'string' ? m.team : 'Assigned team');

                        return (
                          <button
                            key={m._id || m.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectMember(m)}
                            className={`w-full text-left px-3.5 py-2.5 transition flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-brand-50/70 hover:bg-brand-100/60'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                                  {m.name}
                                </span>
                                {m.username && (
                                  <span className="text-xs text-slate-500 font-mono">
                                    @{m.username}
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    m.role === 'teamHead'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : m.role === 'teamAssistant'
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {roleLabel}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400">Team:</span>
                                <span className="font-semibold text-brand-700">
                                  {teamName}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Field 2: Read-Only Assigned Team */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assigned Team
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={assignedTeamName || 'Auto-assigned upon member selection'}
                  placeholder="Auto-assigned upon member selection"
                  className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 text-base md:text-xs font-semibold text-slate-700 cursor-not-allowed focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              {selectedMember ? (
                <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Assigned team for {selectedMember.name}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Select a member to automatically populate their team
                </p>
              )}
            </div>
          </div>

          {/* Section: Criteria Selection */}
          <ActivityCriteriaSelect
            label="Activity Criteria"
            required
            criteriaList={criteriaList}
            value={criteriaId}
            onChange={(newId) => {
              setCriteriaId(newId);
              setQuantity(1);
            }}
            disabled={loading || submitting}
          />

          {/* Points Preview Badge */}
          {selectedCriteria && (
            <div
              className={`rounded-xl border p-4 flex items-center justify-between transition ${
                isNegative ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-700">Calculated score:</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basis: {selectedCriteria.basisLabel} • Frequency: {selectedCriteria.frequency}
                </p>
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  isNegative ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {previewPoints > 0 ? `+${previewPoints}` : previewPoints} pts
              </div>
            </div>
          )}

          {/* Section: Quantity & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showQuantity ? (
              <Input
                label={`Quantity (${selectedCriteria?.basisLabel})`}
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
              />
            ) : (
              <Input
                label="Quantity"
                type="text"
                value="1 (Fixed by criteria)"
                disabled
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Activity Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={getTodayDateString()}
                  required
                  className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base md:text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600"
                />
              </div>
            </div>
          </div>

          {/* Photo Proof Upload */}
          <ProofUpload
            value={proofImage}
            onChange={({ url, publicId }) => {
              setProofImage(url);
              setProofPublicId(publicId);
            }}
            onUploadingChange={setUploadingProof}
            required={false}
            disabled={submitting}
          />

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Note / Reference (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional details, visitor name, or context..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 p-3 text-base md:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-100 focus:border-brand-600 resize-none"
            />
          </div>

          {/* Auto-Approval Notice */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Admin entries are automatically approved and immediately reflected on leaderboards.</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/entries')}
              disabled={submitting || uploadingProof}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={submitting || uploadingProof || loadingMembers || !memberId}
              className="w-full sm:w-auto"
            >
              {uploadingProof ? 'Uploading photo...' : 'Submit & Auto-Approve'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminNewEntry;
