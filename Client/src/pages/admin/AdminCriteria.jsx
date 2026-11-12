import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';

const CATEGORY_NAMES = {
  meeting_day: 'Meeting Day Activities (Weekly)',
  non_meeting_day: 'Non-Meeting Day Activities (Weekly)',
  monthly: 'Team Monthly Criteria',
  one_time: 'Team One-Time Bonus Points',
  penalty: 'Penalties (Negative Points)',
};

const CATEGORY_ORDER = ['meeting_day', 'non_meeting_day', 'monthly', 'one_time', 'penalty'];

const AdminCriteria = () => {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', points: 0, needsProof: false });
  const [saving, setSaving] = useState(false);

  // Toggle Status Confirm State
  const [toggleItem, setToggleItem] = useState(null);
  const [toggling, setToggling] = useState(false);

  const fetchCriteria = async () => {
    try {
      setLoading(true);
      const res = await api.get('/criteria');
      setCriteria(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load criteria list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCriteria();
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
      const res = await api.put(`/criteria/${editingItem._id}`, {
        name: editForm.name.trim(),
        points: Number(editForm.points),
        needsProof: Boolean(editForm.needsProof),
      });

      toast.success('Criteria updated successfully.');
      setCriteria((prev) =>
        prev.map((c) => (c._id === editingItem._id ? res.data.data : c))
      );
      setEditingItem(null);
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
      const res = await api.put(`/criteria/${toggleItem._id}`, {
        isActive: newStatus,
      });

      toast.success(
        `Criteria ${newStatus ? 'activated' : 'deactivated'} successfully.`
      );
      setCriteria((prev) =>
        prev.map((c) => (c._id === toggleItem._id ? res.data.data : c))
      );
      setToggleItem(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setToggling(false);
    }
  };

  // Group criteria by category
  const grouped = criteria.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Activity Criteria
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage scoring rules, point values, proof requirements, and active status.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading criteria list...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const items = grouped[category] || [];
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">
                    {CATEGORY_NAMES[category] || category}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {items.length} criteria
                  </span>
                </div>

                {/* Mobile Cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {items.map((item) => {
                    const isNeg = item.points < 0;
                    return (
                      <div
                        key={item._id}
                        className={`rounded-2xl border p-4 shadow-2xs transition ${
                          item.isActive
                            ? 'border-slate-200 bg-white'
                            : 'border-slate-200 bg-slate-50/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 leading-snug">
                              {item.name}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                              {item.key}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-extrabold border ${
                              isNeg
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isNeg ? item.points : `+${item.points}`} pts
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                            Basis: {item.basis ? item.basis.replace(/_/g, ' ') : '—'}
                          </span>
                          {item.needsProof && (
                            <span className="rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-semibold">
                              Needs Proof
                            </span>
                          )}
                          <Badge status={item.isActive} />
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setToggleItem(item)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                              item.isActive
                                ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {item.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Criteria Name</th>
                        <th className="px-4 py-3 text-right">Points</th>
                        <th className="px-4 py-3">Basis</th>
                        <th className="px-4 py-3 text-center">Proof?</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const isNeg = item.points < 0;
                        return (
                          <tr
                            key={item._id}
                            className={`transition hover:bg-slate-50/80 ${
                              !item.isActive ? 'bg-slate-50/40 text-slate-400' : ''
                            }`}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-xs font-mono text-slate-400">{item.key}</p>
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-extrabold border ${
                                  isNeg
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {isNeg ? item.points : `+${item.points}`}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                              {item.basis ? item.basis.replace(/_/g, ' ') : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              {item.needsProof ? (
                                <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold">
                                  Required
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">None</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              <Badge status={item.isActive} />
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setToggleItem(item)}
                                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                    item.isActive
                                      ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {item.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Criteria Modal */}
      {editingItem && (
        <Modal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          title={`Edit Criteria: ${editingItem.key}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Criteria Name
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Points {editingItem.category === 'penalty' ? '(Negative value)' : '(Positive value)'}
              </label>
              <input
                type="number"
                required
                value={editForm.points}
                onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="needsProofCheck"
                checked={editForm.needsProof}
                onChange={(e) => setEditForm({ ...editForm, needsProof: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="needsProofCheck" className="text-sm font-medium text-slate-700 select-none">
                Requires photo/proof submission
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Activate/Deactivate Dialog */}
      <ConfirmDialog
        isOpen={Boolean(toggleItem)}
        onClose={() => setToggleItem(null)}
        onConfirm={handleToggleConfirm}
        title={toggleItem?.isActive ? 'Deactivate Criteria?' : 'Activate Criteria?'}
        message={`Are you sure you want to ${
          toggleItem?.isActive ? 'deactivate' : 'activate'
        } "${toggleItem?.name}"?`}
        confirmText={toggleItem?.isActive ? 'Deactivate' : 'Activate'}
        confirmColor={toggleItem?.isActive ? 'danger' : 'primary'}
        loading={toggling}
      />
    </div>
  );
};

export default AdminCriteria;

