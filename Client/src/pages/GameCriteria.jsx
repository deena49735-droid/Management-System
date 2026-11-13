import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';

const GameCriteria = ({ isAdminMode: forceAdminMode }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdmin = forceAdminMode !== undefined ? forceAdminMode : user?.role === 'admin' && isAdminRoute;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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
      // Re-fetch structure to automatically recalculate category totals
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Game Criteria"
        subtitle="Official BNI Kadambas Chapter Game points, bonuses, and penalties specification."
        badge={
          isAdmin ? (
            <Badge variant="brand">Admin Editing Enabled</Badge>
          ) : undefined
        }
      />

      {loading ? (
        <Card className="p-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-500">Loading criteria tables...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
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
                        isPenalty ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                    />
                    <h2 className="text-base font-semibold text-slate-900">{cat.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {cat.level === 'team' ? 'Team Level' : 'Member Level'} • {cat.items?.length || 0} Criteria
                  </span>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3 w-16 text-center">#</th>
                        <th className="px-5 py-3">Activity / Parameter</th>
                        <th className="px-5 py-3 w-36">Basis</th>
                        <th className="px-5 py-3 w-32">Frequency</th>
                        <th className="px-5 py-3 text-right w-28">Points</th>
                        {isAdmin && <th className="px-5 py-3 text-center w-28">Status</th>}
                        {isAdmin && <th className="px-5 py-3 text-right w-24">Actions</th>}
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
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                                {item.needsProof && (
                                  <Badge variant="brand" size="xs">
                                    Proof Required
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
                                <Badge variant={item.isActive ? 'success' : 'neutral'} size="xs">
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                            )}

                            {isAdmin && (
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => openEditModal(item)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setToggleItem(item)}
                                    className={item.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}
                                  >
                                    {item.isActive ? 'Deactivate' : 'Activate'}
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
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
                          <div className="flex items-start gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold tabular-nums text-slate-500">
                              {item.displayOrder || '—'}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm leading-snug">
                                {item.name}
                              </p>
                              {item.needsProof && (
                                <span className="inline-block mt-1">
                                  <Badge variant="brand" size="xs">
                                    Proof Required
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
                            <Badge variant={item.isActive ? 'success' : 'neutral'} size="xs">
                              {item.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant={item.isActive ? 'outlineDanger' : 'secondary'}
                                size="xs"
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal (Admin only) */}
      {isAdmin && (
        <Modal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title={`Edit Criteria: ${editingItem?.name || ''}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Criteria Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Points Value <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={editForm.points}
                onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
                required
                className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {editingItem?.level === 'member' && editingItem?.category !== 'penalty' && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="needsProof"
                  checked={editForm.needsProof}
                  onChange={(e) => setEditForm({ ...editForm, needsProof: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="needsProof" className="text-sm font-medium text-slate-700">
                  Proof Upload Required
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
                loading={saving}
              >
                Save Changes
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
          title={toggleItem?.isActive ? 'Deactivate Criteria?' : 'Activate Criteria?'}
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
