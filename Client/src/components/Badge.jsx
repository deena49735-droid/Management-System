import React from 'react';

const roleStyles = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  teamLead: 'bg-blue-50 text-blue-700 border-blue-200',
  teamAssistant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  member: 'bg-slate-100 text-slate-700 border-slate-200',
};

const roleLabels = {
  admin: 'Admin',
  teamLead: 'Team Lead',
  teamAssistant: 'Team Assistant',
  member: 'Member',
};

const Badge = ({ role, status, children, className = '' }) => {
  // If status is passed (boolean or 'active' / 'inactive')
  if (status !== undefined) {
    const isActive = status === true || status === 'active';
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        } ${className}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isActive ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        {children || (isActive ? 'Active' : 'Inactive')}
      </span>
    );
  }

  // If role is passed
  if (role) {
    const style = roleStyles[role] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = roleLabels[role] || role;
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${style} ${className}`}
      >
        {children || label}
      </span>
    );
  }

  // Generic badge fallback
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;

