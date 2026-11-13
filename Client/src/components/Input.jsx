import React from 'react';

const Input = React.forwardRef(
  (
    {
      label,
      helperText,
      errorText,
      id,
      className = '',
      wrapperClassName = '',
      icon: Icon,
      required = false,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {Icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Icon className="h-4 w-4" />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`w-full h-11 min-h-[44px] rounded-lg border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-hidden ${
              Icon ? 'pl-10' : ''
            } ${
              errorText
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
            } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
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

Input.displayName = 'Input';

export default Input;

