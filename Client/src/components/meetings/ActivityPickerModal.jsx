import React, { useState } from 'react';

const allowsMultipleQuantity = (basisLabel = '') => {
  return /Per Visitor|Per Testimonial|Per Specific Ask|Per Week/i.test(basisLabel);
};

const ActivityPickerModal = ({
  isOpen,
  onClose,
  activities = [],
  onAddActivity,
  memberName = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quantities, setQuantities] = useState({});

  if (!isOpen) return null;

  const filteredActivities = activities.filter((act) =>
    act.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQuantityChange = (criteriaId, delta, allowsMulti) => {
    if (!allowsMulti) return;
    setQuantities((prev) => {
      const current = prev[criteriaId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [criteriaId]: next };
    });
  };

  const handleSelect = (act) => {
    const allowsMulti = allowsMultipleQuantity(act.basisLabel);
    const qty = allowsMulti ? quantities[act._id] || 1 : 1;
    onAddActivity(act, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-2xs transition-opacity animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Add Meeting Activity
            </h3>
            {memberName && (
              <p className="text-xs text-slate-500 mt-0.5">
                For <span className="font-semibold text-slate-700">{memberName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search meeting day activities..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* List of Activities */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100">
          {filteredActivities.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching activities found.
            </div>
          ) : (
            filteredActivities.map((act) => {
              const allowsMulti = allowsMultipleQuantity(act.basisLabel);
              const qty = allowsMulti ? quantities[act._id] || 1 : 1;
              const totalPoints = act.points * qty;

              return (
                <div
                  key={act._id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50/80 p-2.5 rounded-xl transition"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                      {act.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {act.basisLabel || 'Per Member'} •{' '}
                      <span className="font-semibold text-emerald-600">
                        +{act.points} pts each
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {allowsMulti && (
                      <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(act._id, -1, allowsMulti)}
                          disabled={qty <= 1}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 font-bold text-sm"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-slate-800">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(act._id, 1, allowsMulti)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelect(act)}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:bg-blue-800 transition"
                    >
                      Add (+{totalPoints})
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-right shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityPickerModal;

