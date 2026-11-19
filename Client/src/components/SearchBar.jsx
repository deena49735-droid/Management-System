import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Reusable SearchBar component with optional debouncing, clear button,
 * accessible touch targets, and consistent design matching the application style.
 *
 * @param {string} value - Current search value
 * @param {Function} onChange - Callback invoked with new search string
 * @param {Function} [onClear] - Optional explicit clear callback
 * @param {string} [placeholder='Search...'] - Input placeholder text
 * @param {string} [className=''] - Additional CSS classes
 * @param {number} [debounceMs=0] - Debounce delay in ms (0 for instant client-side filtering)
 * @param {string} [id] - Input element id
 * @param {boolean} [autoFocus=false] - Auto focus on mount
 */
const SearchBar = ({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  debounceMs = 0,
  id,
  autoFocus = false,
}) => {
  const [innerVal, setInnerVal] = useState(value || '');
  const timerRef = useRef(null);

  // Sync internal state if parent value changes
  useEffect(() => {
    setInnerVal(value || '');
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInnerVal(val);

    if (debounceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, debounceMs);
    } else {
      onChange(val);
    }
  };

  const handleClear = () => {
    setInnerVal('');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`relative flex-1 min-w-[200px] ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        <Search className="h-4 w-4 shrink-0" />
      </div>
      <input
        id={id}
        type="text"
        value={innerVal}
        onChange={handleChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full h-11 min-h-[44px] rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-hidden focus:ring-2 focus:ring-brand-100 transition shadow-2xs"
      />
      {innerVal ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-hidden transition"
          aria-label="Clear search query"
        >
          <X className="h-4 w-4 shrink-0" />
        </button>
      ) : null}
    </div>
  );
};

export default SearchBar;
