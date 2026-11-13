import React from 'react';
import { ChevronDown } from 'lucide-react';

const Select = React.forwardRef(
  (
    {
      label,
      helperText,
      errorText,
      id,
      options = [],
      children,
      className = '',
      wrapperClassName = '',
      required = false,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full h-11 min-h-[44px] appearance-none rounded-lg border bg-white pl-3.5 pr-10 text-sm text-slate-900 transition-colors focus:outline-hidden ${
              errorText
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
            } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
            {...props}
          >
            {options.length > 0
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        {errorText ? (
          <p className="text-xs text-rose-600 mt-1 font-medium">{errorText}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;

