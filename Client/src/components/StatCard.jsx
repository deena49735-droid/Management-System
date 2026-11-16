import React from 'react';

const tintVariants = {
  brand: 'bg-brand-50 text-brand-600',
  indigo: 'bg-brand-50 text-brand-600',
  blue: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  variant = 'brand',
  hint,
  hintType = 'neutral',
  loading = false,
  className = '',
  onClick,
}) => {
  const iconStyle = tintVariants[variant] || tintVariants.brand;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs transition ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </span>
        {Icon && (
          <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ${iconStyle}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>

      <div className="mt-2 sm:mt-2.5">
        {loading ? (
          <div className="h-7 sm:h-8 w-20 sm:w-24 animate-pulse rounded-md bg-slate-200" />
        ) : (
          <p className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 tabular-nums truncate">
            {value}
          </p>
        )}

        {hint && (
          <p
            className={`mt-1 text-[11px] sm:text-xs truncate ${
              hintType === 'success'
                ? 'text-emerald-600 font-medium'
                : hintType === 'danger'
                ? 'text-rose-600 font-medium'
                : hintType === 'warning'
                ? 'text-amber-600 font-medium'
                : 'text-slate-500'
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;

