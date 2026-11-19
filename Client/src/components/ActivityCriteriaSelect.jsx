import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Search, X, Check } from 'lucide-react';

const DEFAULT_CATEGORY_ORDER = ['meeting_day', 'non_meeting_day', 'penalty'];

const DEFAULT_CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities',
  non_meeting_day: 'Non-Meeting Day Activities',
  penalty: 'Negative Points Criteria',
};

const DEFAULT_TAB_LABELS = {
  meeting_day: 'Meeting Day',
  non_meeting_day: 'Non-Meeting',
  penalty: 'Penalties',
};

const ActivityCriteriaSelect = ({
  label = 'Activity criteria',
  required = true,
  criteriaList = [],
  value = '',
  onChange,
  disabled = false,
  error = '',
  placeholder = 'Select an activity from the list...',
  categoryOrder = DEFAULT_CATEGORY_ORDER,
  categoryLabels = DEFAULT_CATEGORY_LABELS,
  categoryTabLabels = DEFAULT_TAB_LABELS,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('all');
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Find currently selected criterion
  const selectedCriterion = useMemo(() => {
    if (!value) return null;
    return criteriaList.find(
      (c) => (c.id || c._id)?.toString() === value?.toString()
    ) || null;
  }, [criteriaList, value]);

  // Filtered criteria based on active category pill and search query
  const filteredCriteria = useMemo(() => {
    let list = criteriaList;
    if (selectedCategoryTab !== 'all') {
      list = list.filter((c) => c.categoryKey === selectedCategoryTab);
    }
    if (activitySearch.trim()) {
      const q = activitySearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          (c.basisLabel && c.basisLabel.toLowerCase().includes(q)) ||
          (c.categoryLabel && c.categoryLabel.toLowerCase().includes(q))
      );
    }
    return list;
  }, [criteriaList, selectedCategoryTab, activitySearch]);

  // Grouped criteria in category order
  const groupedCriteria = useMemo(() => {
    return categoryOrder.reduce((acc, catKey) => {
      const items = filteredCriteria.filter((c) => c.categoryKey === catKey);
      if (items.length > 0) acc[catKey] = items;
      return acc;
    }, {});
  }, [categoryOrder, filteredCriteria]);

  const hasAnyItems = Object.keys(groupedCriteria).length > 0;

  const handleSelect = (item) => {
    const itemId = item.id || item._id;
    if (onChange) {
      onChange(itemId, item);
    }
    setIsOpen(false);
    setActivitySearch('');
  };

  return (
    <div ref={containerRef} className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Selected Activity Display Card */}
      {selectedCriterion ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                  {selectedCriterion.categoryLabel ||
                    categoryLabels[selectedCriterion.categoryKey] ||
                    'Activity'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                  Proof optional
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug break-words">
                {selectedCriterion.name}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`font-bold px-2 py-0.5 rounded border tabular-nums ${
                    selectedCriterion.points < 0
                      ? 'text-rose-700 bg-rose-50 border-rose-100'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  }`}
                >
                  {selectedCriterion.points > 0
                    ? `+${selectedCriterion.points}`
                    : selectedCriterion.points}{' '}
                  pts
                </span>
                <span className="text-slate-500 font-medium">
                  Basis: {selectedCriterion.basisLabel || 'Per Member'}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen((prev) => !prev)}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-expanded={isOpen}
            >
              <span>{isOpen ? 'Close list' : 'Change'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      ) : (
        /* Unselected Trigger Button */
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left transition min-h-[44px] ${
            isOpen
              ? 'border-brand-500 ring-2 ring-brand-100 bg-white'
              : error
              ? 'border-rose-300 bg-white hover:border-rose-400'
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          aria-expanded={isOpen}
        >
          <span className="flex items-center gap-2 text-sm text-slate-500 font-medium truncate">
            <Sparkles className="h-4 w-4 text-brand-500 shrink-0" />
            {placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}

      {/* Integrated In-Flow Activities List Panel */}
      {isOpen && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3 space-y-2.5 transition-all duration-150">
          {/* Search & Filter Header */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search by activity name..."
                className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100"
                autoFocus
              />
              {activitySearch && (
                <button
                  type="button"
                  onClick={() => setActivitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category filter tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategoryTab('all')}
                className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap min-h-[30px] ${
                  selectedCategoryTab === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All ({criteriaList.length})
              </button>
              {categoryOrder.map((catKey) => {
                const count = criteriaList.filter(
                  (c) => c.categoryKey === catKey
                ).length;
                if (!count) return null;
                const isTabActive = selectedCategoryTab === catKey;
                const tabLabel =
                  categoryTabLabels[catKey] ||
                  (catKey === 'meeting_day'
                    ? 'Meeting Day'
                    : catKey === 'non_meeting_day'
                    ? 'Non-Meeting'
                    : catKey === 'penalty'
                    ? 'Penalties'
                    : categoryLabels[catKey] || catKey);
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategoryTab(catKey)}
                    className={`px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap min-h-[30px] ${
                      isTabActive
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tabLabel} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Internal Scrollable Activities List */}
          <div className="max-h-56 sm:max-h-64 overflow-y-auto space-y-3 pr-1 overscroll-contain">
            {!hasAnyItems ? (
              <div className="py-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-dashed border-slate-200">
                No matching activities found for &ldquo;{activitySearch}&rdquo;
              </div>
            ) : (
              categoryOrder.map((catKey) => {
                const items = groupedCriteria[catKey];
                if (!items || items.length === 0) return null;
                return (
                  <div key={catKey} className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                      {categoryLabels[catKey] || catKey}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((c) => {
                        const cid = c.id || c._id;
                        const isSelected =
                          cid?.toString() === value?.toString();
                        const isItemNegative = Number(c.points) < 0;
                        return (
                          <button
                            key={cid}
                            type="button"
                            onClick={() => handleSelect(c)}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start justify-between gap-2.5 min-h-[44px] ${
                              isSelected
                                ? 'bg-brand-50 border-brand-400 ring-2 ring-brand-200 text-brand-900 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-semibold leading-snug break-words">
                                  {c.name}
                                </span>
                                {c.needsProof && (
                                  <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    Proof req.
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Basis: {c.basisLabel || 'Per Member'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums border ${
                                  isItemNegative
                                    ? 'text-rose-700 bg-rose-50 border-rose-100'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                }`}
                              >
                                {c.points > 0 ? `+${c.points}` : c.points} pts
                              </span>
                              {isSelected && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shrink-0">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityCriteriaSelect;
