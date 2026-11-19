import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, Edit3, Power, AlertCircle, FileText, Search } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Card from '../components/Card';
import SearchBar from '../components/SearchBar';

const GameCriteria = ({ isAdminMode: forceAdminMode }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin =
    forceAdminMode !== undefined
      ? forceAdminMode
      : user?.role === 'admin' && isAdminRoute;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal State (Admin only)
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', points: 0, needsProof: false });
  const [saving, setSaving] = useState(false);

  // Toggle Active State (Admin only)
  const [toggleItem, setToggleItem] = useState(null);
  const [toggling, setToggling] = useState(false);

  const fetchCriteriaStructure = async () => {
    try {
      setLoading(true);
      const res = await api.get('/criteria/structure');
      setCategories(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load game criteria structure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCriteriaStructure();
  }, []);

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      points: item.points,
      needsProof: Boolean(item.needsProof),
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Criteria name is required.');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/criteria/${editingItem.id || editingItem._id}`, {
        name: editForm.name.trim(),
        points: Number(editForm.points),
        needsProof: Boolean(editForm.needsProof),
      });

      toast.success('Criteria updated successfully.');
      setEditingItem(null);
      await fetchCriteriaStructure();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update criteria.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleItem) return;
    try {
      setToggling(true);
      const newStatus = !toggleItem.isActive;
      await api.put(`/criteria/${toggleItem.id || toggleItem._id}`, {
        isActive: newStatus,
      });

      toast.success(`Criteria ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      setToggleItem(null);
      await fetchCriteriaStructure();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update criteria status.');
    } finally {
      setToggling(false);
    }
  };

  // Filter categories and criteria by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.trim().toLowerCase();

    return categories
      .map((cat) => {
        const catMatches = cat.label?.toLowerCase().includes(q) || cat.key?.toLowerCase().includes(q);
        const matchingItems = (cat.items || []).filter((item) => {
          if (catMatches) return true;
          return (
            item.name?.toLowerCase().includes(q) ||
            item.basisLabel?.toLowerCase().includes(q) ||
            item.frequency?.toLowerCase().includes(q) ||
            item.key?.toLowerCase().includes(q)
          );
        });

        if (matchingItems.length === 0) return null;
        return {
          ...cat,
          items: matchingItems,
          totalOriginalItems: cat.items?.length || 0,
        };
      })
      .filter(Boolean);
  }, [categories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Game criteria"
        subtitle="Official BNI Kadambas Chapter Game points, bonuses, and penalties specification."
        badge={
          isAdmin ? (
            <Badge variant="neutral">Admin editing enabled</Badge>
          ) : undefined
        }
      />

      {/* Search Toolbar */}
      {!loading && categories.length > 0 && (
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search criteria by activity name, parameter, basis, or category..."
            />
            {searchQuery && (
              <div className="flex items-center gap-2 self-center sm:self-auto shrink-0 text-xs text-slate-500">
                <span>
                  Found in <strong className="text-slate-800">{filteredCategories.length}</strong> categories
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="font-semibold text-brand-600 hover:text-brand-800 ml-1"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-6">
          <SkeletonTable rows={5} cols={5} />
          <SkeletonTable rows={5} cols={5} />
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No game criteria configured"
          description="Criteria definitions have not been loaded yet."
        />
      ) : filteredCategories.length === 0 && searchQuery ? (
        <EmptyState
          icon={Search}
          title="No criteria match your search"
          description={`No game parameters found matching "${searchQuery}". Try a different keyword.`}
          actionLabel="Clear search"
          onAction={() => setSearchQuery('')}
        />
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => {
            const isPenalty = cat.key === 'penalty';

            return (
              <div
                key={cat.key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
              >
                {/* Block Title Header */}
                <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        isPenalty ? 'bg-rose-500' : 'bg-brand-600'
                      }`}
                    />
                    <h2 className="text-base font-semibold text-slate-900">{cat.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {cat.level === 'team' ? 'Team level' : 'Member level'} •{' '}
                    {searchQuery ? (
                      <span className="text-brand-700 font-semibold">
                        {cat.items?.length} of {cat.totalOriginalItems} criteria matching
                      </span>
                    ) : (
                      `${cat.items?.length || 0} criteria`
                    )}
                  </span>
                </div>

                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 w-16 text-center">#</th>
                        <th className="px-5 py-3">Activity / Parameter</th>
                        <th className="px-5 py-3 w-44">Basis</th>
                        <th className="px-5 py-3 w-32">Frequency</th>
                        <th className="px-5 py-3 text-right w-28">Points</th>
                        {isAdmin && <th className="px-5 py-3 text-center w-28">Status</th>}
                        {isAdmin && <th className="px-5 py-3 text-right w-36">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cat.items?.map((item) => {
                        const isInactive = !item.isActive;

                        return (
                          <tr
                            key={item.id || item._id}
                            className={`transition hover:bg-slate-50/80 ${
                              isInactive ? 'opacity-60 bg-slate-50/40' : ''
                            }`}
                          >
                            <td className="px-5 py-3 text-center text-xs font-bold tabular-nums text-slate-400">
                              {item.displayOrder || '—'}
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                                {item.needsProof && (
                                  <Badge variant="neutral">
                                    Proof required
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3 text-xs text-slate-600">
                              {item.basisLabel || '—'}
                            </td>

                            <td className="px-5 py-3 text-xs text-slate-600 capitalize">
                              {item.frequency || 'Weekly'}
                            </td>

                            <td className="px-5 py-3 text-right whitespace-nowrap font-bold tabular-nums">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border ${
                                  isPenalty
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {item.points > 0 ? `+${item.points}` : item.points} pts
                              </span>
                            </td>

                            {isAdmin && (
                              <td className="px-5 py-3 text-center whitespace-nowrap">
                                <Badge variant={item.isActive ? 'success' : 'neutral'}>
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                            )}

                            {isAdmin && (
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditModal(item)}
                                    icon={Edit3}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setToggleItem(item)}
                                    className={
                                      item.isActive
                                        ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                    }
                                  >
                                    {item.isActive ? 'Deactivate' : 'Activate'}
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Clean TOTAL row for categories with totals */}
                      {typeof cat.total === 'number' && (
                        <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900">
                          <td className="px-5 py-3.5 text-center text-xs text-slate-400">Total</td>
                          <td className="px-5 py-3.5 text-sm uppercase tracking-wider text-slate-800" colSpan={3}>
                            Total, {cat.label}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap tabular-nums">
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border bg-brand-50 text-brand-700 border-brand-200">
                              {cat.total.toLocaleString()} pts
                            </span>
                          </td>
                          {isAdmin && <td colSpan={2} />}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View (Below 768px: clean cards, no horizontal scroll) */}
                <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
                  {cat.items?.map((item) => {
                    const isInactive = !item.isActive;

                    return (
                      <div
                        key={item.id || item._id}
                        className={`p-4 space-y-2.5 transition ${
                          isInactive ? 'opacity-60 bg-slate-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold tabular-nums text-slate-600">
                              {item.displayOrder || '—'}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm leading-snug">
                                {item.name}
                              </p>
                              {item.needsProof && (
                                <span className="inline-block mt-1">
                                  <Badge variant="neutral">
                                    Proof required
                                  </Badge>
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums border ${
                              isPenalty
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {item.points > 0 ? `+${item.points}` : item.points} pts
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                          <span>
                            Basis: <strong className="text-slate-700">{item.basisLabel || '—'}</strong>
                          </span>
                          <span className="capitalize">
                            Freq: <strong className="text-slate-700">{item.frequency || 'Weekly'}</strong>
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
                            <Badge variant={item.isActive ? 'success' : 'neutral'}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant={item.isActive ? 'outlineDanger' : 'secondary'}
                                size="sm"
                                onClick={() => setToggleItem(item)}
                              >
                                {item.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Clean Mobile TOTAL row */}
                  {typeof cat.total === 'number' && (
                    <div className="p-4 bg-slate-50/90 border-t-2 border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Total, {cat.label}
                      </span>
                      <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border bg-brand-50 text-brand-700 border-brand-200 tabular-nums">
                        {cat.total.toLocaleString()} pts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal (Admin only) - bottom sheet on mobile */}
      {isAdmin && (
        <Modal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title={`Edit criteria: ${editingItem?.name || ''}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Criteria name"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />

            <Input
              label="Points value"
              type="number"
              required
              value={editForm.points}
              onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
            />

            {editingItem?.level === 'member' && editingItem?.category !== 'penalty' && (
              <div className="flex items-center gap-2.5 min-h-[44px]">
                <input
                  type="checkbox"
                  id="needsProof"
                  checked={editForm.needsProof}
                  onChange={(e) => setEditForm({ ...editForm, needsProof: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="needsProof" className="text-sm font-medium text-slate-700 cursor-pointer py-2">
                  Proof photo upload required
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
              >
                Save changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Toggle Confirmation Dialog */}
      {isAdmin && (
        <ConfirmDialog
          isOpen={!!toggleItem}
          onClose={() => setToggleItem(null)}
          onConfirm={handleToggleConfirm}
          title={toggleItem?.isActive ? 'Deactivate criteria?' : 'Activate criteria?'}
          message={`Are you sure you want to ${
            toggleItem?.isActive ? 'deactivate' : 'activate'
          } "${toggleItem?.name}"?`}
          confirmText={toggleItem?.isActive ? 'Deactivate' : 'Activate'}
          confirmVariant={toggleItem?.isActive ? 'danger' : 'primary'}
          loading={toggling}
        />
      )}
    </div>
  );
};

export default GameCriteria;
