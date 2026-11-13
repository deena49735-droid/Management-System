import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

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

  const content = (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Game Criteria</h1>
          <p className="text-sm text-slate-500 mt-1">
            Official BNI Kadambas Chapter Game points, bonuses, and penalties specification.
          </p>
        </div>
        {isAdmin && (
          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
            Admin Editing Enabled
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading criteria tables...</p>
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map((cat) => {
            const isPenalty = cat.key === 'penalty';

            return (
              <div
                key={cat.key}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Block Title Header */}
                <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        isPenalty ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                    />
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">{cat.label}</h2>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {cat.level === 'team' ? 'Team Level' : 'Member Level'} • {cat.items?.length || 0} Criteria
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  {!isPenalty ? (
                    // Regular Blocks (Meeting Day, Non-Meeting Day, Monthly Points, One Time Bonus)
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                          <th className="py-3 px-4 sm:px-6">Activity</th>
                          <th className="py-3 px-4 text-right">Points</th>
                          <th className="py-3 px-4 sm:px-6">Basis</th>
                          {isAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cat.items?.map((item) => (
                          <tr
                            key={item.id || item.key}
                            className={`transition hover:bg-slate-50/80 ${
                              !item.isActive ? 'opacity-50 bg-slate-50/30' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.needsProof && (
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                                    Proof Required
                                  </span>
                                )}
                                {!item.isActive && (
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                              +{item.points}
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 text-slate-600 text-xs sm:text-sm">
                              {item.basisLabel || 'Per Member'}
                            </td>
                            {isAdmin && (
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                                    title="Edit Criteria"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setToggleItem(item)}
                                    className={`rounded-lg p-1.5 transition ${
                                      item.isActive
                                        ? 'text-slate-500 hover:bg-slate-100 hover:text-rose-600'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-600'
                                    }`}
                                    title={item.isActive ? 'Deactivate Criteria' : 'Activate Criteria'}
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {item.isActive ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {/* TOTAL ROW */}
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                          <td className="py-3.5 px-4 sm:px-6">
                            TOTAL - {cat.label}
                          </td>
                          <td className="py-3.5 px-4 text-right text-indigo-700 text-base">
                            {cat.total !== null ? cat.total : 0}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-slate-500 text-xs">
                            Active Criteria Total
                          </td>
                          {isAdmin && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    // Negative Points Criteria Block (Frequency | Negative Points Criteria | Penalty Points | Basis)
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                          <th className="py-3 px-4 sm:px-6">Frequency</th>
                          <th className="py-3 px-4">Negative Points Criteria</th>
                          <th className="py-3 px-4 text-right">Penalty Points</th>
                          <th className="py-3 px-4 sm:px-6">Basis</th>
                          {isAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Weekly Penalties Group */}
                        <tr className="bg-slate-100/60 font-semibold text-xs text-slate-700">
                          <td colSpan={isAdmin ? 5 : 4} className="py-2 px-4 sm:px-6">
                            Weekly Penalties
                          </td>
                        </tr>
                        {cat.weekly?.map((item) => (
                          <tr
                            key={item.id || item.key}
                            className={`transition hover:bg-slate-50/80 ${
                              !item.isActive ? 'opacity-50 bg-slate-50/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 sm:px-6 text-slate-500 text-xs font-medium">
                              Weekly
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {!item.isActive && (
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">
                              {item.points < 0 ? item.points : `-${item.points}`}
                            </td>
                            <td className="py-3 px-4 sm:px-6 text-slate-600 text-xs sm:text-sm">
                              {item.basisLabel || 'Per Member'}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                                    title="Edit Criteria"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setToggleItem(item)}
                                    className={`rounded-lg p-1.5 transition ${
                                      item.isActive
                                        ? 'text-slate-500 hover:bg-slate-100 hover:text-rose-600'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-600'
                                    }`}
                                    title={item.isActive ? 'Deactivate Criteria' : 'Activate Criteria'}
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {item.isActive ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}

                        {/* Monthly Penalties Group */}
                        <tr className="bg-slate-100/60 font-semibold text-xs text-slate-700">
                          <td colSpan={isAdmin ? 5 : 4} className="py-2 px-4 sm:px-6">
                            Monthly Penalties
                          </td>
                        </tr>
                        {cat.monthly?.map((item) => (
                          <tr
                            key={item.id || item.key}
                            className={`transition hover:bg-slate-50/80 ${
                              !item.isActive ? 'opacity-50 bg-slate-50/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 sm:px-6 text-slate-500 text-xs font-medium">
                              Monthly
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {!item.isActive && (
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-600">
                              {item.points < 0 ? item.points : `-${item.points}`}
                            </td>
                            <td className="py-3 px-4 sm:px-6 text-slate-600 text-xs sm:text-sm">
                              {item.basisLabel || 'Per Member'}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition"
                                    title="Edit Criteria"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setToggleItem(item)}
                                    className={`rounded-lg p-1.5 transition ${
                                      item.isActive
                                        ? 'text-slate-500 hover:bg-slate-100 hover:text-rose-600'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-600'
                                    }`}
                                    title={item.isActive ? 'Deactivate Criteria' : 'Activate Criteria'}
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {item.isActive ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal (Admin Only) */}
      {isAdmin && (
        <Modal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title={`Edit Criteria: ${editingItem?.name || ''}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Criteria Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Points Value {editingItem?.category === 'penalty' ? '(Negative number)' : ''}
              </label>
              <input
                type="number"
                value={editForm.points}
                onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
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

  // If accessed directly from /criteria (non-admin layout or standalone), render with Navbar
  if (!isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {content}
        </main>
      </div>
    );
  }

  // Inside /admin/criteria layout
  return content;
};

export default GameCriteria;

