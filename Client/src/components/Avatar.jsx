import React from 'react';

const sizeStyles = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-14 w-14 text-lg',
};

const roleColors = {
  admin: 'bg-gradient-to-br from-brand-600 to-brand-700 text-white border-brand-700/80 shadow-2xs',
  teamHead: 'bg-slate-900 text-white border-slate-900 shadow-2xs',
  teamAssistant: 'bg-slate-700 text-white border-slate-700 shadow-2xs',
  member: 'bg-slate-100 text-slate-700 border-slate-300 shadow-2xs',
  default: 'bg-slate-100 text-slate-700 border-slate-300 shadow-2xs',
};

const Avatar = ({
  name = '',
  role,
  size = 'md',
  src,
  className = '',
}) => {
  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const sizeClass = sizeStyles[size] || sizeStyles.md;
  const colorClass = roleColors[role] || roleColors.default;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover shrink-0 border border-slate-200 ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full font-semibold flex items-center justify-center shrink-0 border select-none ${sizeClass} ${colorClass} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
};

export default Avatar;

