import React from 'react';

const roleStyles = {
  admin: 'bg-brand-50 text-brand-700 border-brand-200',
  teamHead: 'bg-slate-100 text-slate-700 border-slate-200',
  teamAssistant: 'bg-slate-100 text-slate-700 border-slate-200',
  member: 'bg-slate-100 text-slate-700 border-slate-200',
};

const roleLabels = {
  admin: 'Admin',
  teamHead: 'Team Head',
  teamAssistant: 'Team Assistant',
  member: 'Member',
};

const variantStyles = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  indigo: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-slate-100 text-slate-700 border-slate-200',
};

const variantDots = {
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  neutral: 'bg-slate-400',
  brand: 'bg-brand-500',
  indigo: 'bg-slate-400',
  blue: 'bg-slate-400',
};

const entryStatusStyles = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
};

const entryStatusDots = {
  pending: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  draft: 'bg-slate-400',
  submitted: 'bg-amber-500',
};

const entryStatusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  draft: 'Draft',
  submitted: 'Submitted',
};

const Badge = ({
  role,
  status,
  variant,
  children,
  dot = true,
  className = '',
}) => {
  // 1. Explicit Variant (success | danger | warning | neutral | indigo)
  if (variant) {
    const style = variantStyles[variant] || variantStyles.neutral;
    const dotColor = variantDots[variant] || variantDots.neutral;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${style} ${className}`}
      >
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
        {children}
      </span>
    );
  }

  // 2. Entry or Meeting Status (pending | approved | rejected | draft | submitted)
  if (
    status === 'pending' ||
    status === 'approved' ||
    status === 'rejected' ||
    status === 'draft' ||
    status === 'submitted'
  ) {
    const style = entryStatusStyles[status];
    const dotColor = entryStatusDots[status];
    const label = entryStatusLabels[status];
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${style} ${className}`}
      >
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
        {children || label}
      </span>
    );
  }

  // 3. Boolean or 'active' / 'inactive' status
  if (status !== undefined) {
    const isActive = status === true || status === 'active';
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        } ${className}`}
      >
        {dot && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
        )}
        {children || (isActive ? 'Active' : 'Inactive')}
      </span>
    );
  }

  // 4. User Role badge
  if (role) {
    const style = roleStyles[role] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = roleLabels[role] || role;
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${style} ${className}`}
      >
        {children || label}
      </span>
    );
  }

  // 5. Default fallback
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
